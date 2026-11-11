import { clock } from '../lib/format'
import type { Lane } from '../lib/race'
import { SPRITE_W } from '../lib/sprite'
import Horse from './Horse'

const PLACES = ['1st', '2nd', '3rd']

// The left edge of a horse with n open locks. The nose of a horse with 5 locks is on the finish line.
// The unit is % for an element in the track, and cqw for a length that must not depend on the parent.
export const at = (n: number, spriteW: number, unit = '%') => `calc((100${unit} - ${spriteW + 8}px) * ${n} / 5)`

// One lane of the derby: the horse jumps one step for each open lock. px is the size of one sprite pixel.
// With notes, the lane also shows the last command or the result next to the horse.
// delay is the wait in ms before the lane wipes in, so a list of lanes can enter one after the other.
export default function Track({
  lane, px, settled, notes = false, delay = 0,
}: {
  lane: Lane; px: number; settled: boolean; notes?: boolean; delay?: number
}) {
  const { horse, entry } = lane
  const spriteW = SPRITE_W * px
  const locks = entry.locks_open
  const running = entry.state === 'running'
  const escaped = entry.state === 'escaped'
  const note = !notes
    ? ''
    : escaped
      ? `${PLACES[(entry.finish_pos ?? 0) - 1] ?? 'Escaped'} in ${clock(entry.solved_ms ?? 0)}`
      : settled
        ? `${locks} of 5 locks`
        : running && entry.last_step
          ? `$ ${entry.last_step}`
          : ''
  // The note goes on the side of the horse that has more room.
  const ahead = locks < 3
  return (
    <div className="@container relative h-full overflow-hidden bg-accent motion-safe:animate-wipe" style={{ animationDelay: `${delay}ms` }}>
      {[1, 2, 3, 4].map((n) => (
        <i key={n} className="absolute inset-y-0 w-1 bg-accent-deep" style={{ left: `calc(${at(n, spriteW)} + ${spriteW}px)` }} />
      ))}
      <i className={`finish absolute inset-y-0 right-0 w-8 ${escaped ? 'motion-safe:animate-flag' : ''}`} />
      {/* The lane flashes each time a lock opens. The key restarts the flash. */}
      {locks > 0 && <i key={locks} className="pointer-events-none absolute inset-0 bg-text opacity-0 motion-safe:animate-flash" />}
      <div
        className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-500 [transition-timing-function:steps(6)]"
        style={{ left: at(locks, spriteW) }}
      >
        {note && (
          <p
            className="absolute top-1/2 -translate-y-1/2 truncate text-[18px] font-medium text-on-accent"
            style={
              ahead
                ? { left: spriteW + 16, maxWidth: `calc(100cqw - ${spriteW + 64}px - ${at(locks, spriteW, 'cqw')})` }
                : { right: spriteW + 12, maxWidth: `calc(${at(locks, spriteW, 'cqw')} - 24px)` }
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
        {/* The key restarts the hop each time a lock opens. A horse that escaped keeps on hopping. */}
        <div key={locks} className={escaped ? 'motion-safe:animate-cheer' : locks ? 'motion-safe:animate-hop' : ''}>
          <Horse id={horse.id} scale={px} running={running} />
        </div>
      </div>
    </div>
  )
}
