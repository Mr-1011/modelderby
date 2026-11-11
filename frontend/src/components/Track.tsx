import { usd } from '../lib/format'
import type { Lane } from '../lib/race'
import { GRASS, SPRITE_W } from '../lib/sprite'
import Horse from './Horse'

const PLACES = ['1st', '2nd', '3rd']

// The left edge of a horse after n of 5 steps, and one step is 20 of progress. The nose of a horse with 5 steps is on the finish line.
// The unit is % for an element in the track, and cqw for a length that must not depend on the parent.
export const at = (n: number, spriteW: number, unit = '%') => `calc((100${unit} - ${spriteW + 8}px) * ${n} / 5)`

// The meadow under a lane or a fence. stripe is 0 or 1: the lanes change between a light and a dark stripe.
export const grass = (px: number, stripe = 0) => ({ backgroundImage: GRASS[stripe % 2], backgroundSize: px * 16 })

// The white fence above and below the lanes.
export function Rail({ px }: { px: number }) {
  return (
    <div className="h-full" style={grass(px, 1)}>
      <div className="rail h-full" />
    </div>
  )
}

// One lane of the derby: the horse moves with its progress. px is the size of one sprite pixel.
// A horse can be higher than its lane. Then it overlaps the lane above it, like on a fairground derby.
// The note is at the middle of the horse, so the horse of the lane below does not hide it.
// With notes, the lane also shows the last command or the result next to the horse.
export default function Track({
  lane, px, settled, notes = false, stripe = 0,
}: {
  lane: Lane; px: number; settled: boolean; notes?: boolean; stripe?: number
}) {
  const { horse, entry } = lane
  const spriteW = SPRITE_W * px
  const steps = entry.progress / 20
  const running = entry.state === 'running'
  const escaped = entry.state === 'escaped'
  const note = !notes
    ? ''
    : escaped
      ? `${PLACES[(entry.finish_pos ?? 0) - 1] ?? 'Finished'}, ${usd(entry.cost_usd)}`
      : entry.state === 'out'
        ? 'Out'
        : settled
          ? `${Math.round(entry.progress)}%`
          : running && entry.last_step
            ? `$ ${entry.last_step}`
            : ''
  // The note goes on the side of the horse that has more room.
  const ahead = steps < 3
  return (
    <div className="@container relative h-full overflow-x-clip" style={grass(px, stripe)}>
      {[1, 2, 3, 4].map((n) => (
        <i key={n} className="absolute inset-y-0 w-1 bg-text/25" style={{ left: `calc(${at(n, spriteW)} + ${spriteW}px)` }} />
      ))}
      <i className={`finish absolute inset-y-0 right-0 w-8 ${escaped ? 'motion-safe:animate-flag' : ''}`} />
      {/* The lane flashes each time the horse passes a mark. The key restarts the flash. */}
      {steps >= 1 && <i key={Math.floor(steps)} className="pointer-events-none absolute inset-0 bg-text opacity-0 motion-safe:animate-flash" />}
      <div
        className="absolute transition-[left] duration-500 [transition-timing-function:steps(6)]"
        style={{ left: at(steps, spriteW), bottom: px }}
      >
        {note && (
          <p
            className="absolute top-1/2 -translate-y-1/2 truncate bg-bg px-2 text-[18px] font-medium text-text"
            style={
              ahead
                ? { left: spriteW + 16, maxWidth: `calc(100cqw - ${spriteW + 64}px - ${at(steps, spriteW, 'cqw')})` }
                : { right: spriteW + 12, maxWidth: `calc(${at(steps, spriteW, 'cqw')} - 24px)` }
            }
          >
            {note}
          </p>
        )}
        {/* Dust behind a running horse: two squares of 2 sprite pixels. */}
        {running &&
          [0, 1].map((n) => (
            <i
              key={n}
              className="absolute left-0 hidden bg-text motion-safe:block motion-safe:animate-dust"
              style={{ width: px * 2, height: px * 2, bottom: px * (2 + n * 4), animationDelay: `${n * 210}ms` }}
            />
          ))}
        {/* The key restarts the hop each time the horse moves. A horse that finished keeps on hopping. */}
        <div key={steps} className={escaped ? 'motion-safe:animate-cheer' : steps ? 'motion-safe:animate-hop' : ''}>
          <Horse id={horse.id} scale={px} running={running} />
        </div>
      </div>
    </div>
  )
}
