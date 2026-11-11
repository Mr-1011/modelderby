import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { clock, oats, odds } from '../lib/format'
import type { RaceSummary } from '../lib/queries'
import { RACE_MS, ROOMS } from '../lib/race'
import Glyph from './Glyph'
import Horse from './Horse'
import { grass } from './Track'

// One race in a list: the image of its challenge, its status, its horses, its pool and its favorite.
// It links to the race page.
export default function RaceCard({ summary, now, children }: { summary: RaceSummary; now: number; children?: ReactNode }) {
  const { race, horses, pool, favorite, favoriteOdds } = summary
  const running = race.status === 'running'
  const status =
    race.status === 'open'
      ? `Starts in ${clock(Date.parse(race.countdown_ends_at ?? race.opens_at) - now + 999)}`
      : running
        ? `${clock(now - Date.parse(race.started_at!))} / ${clock(RACE_MS)}`
        : `${horses.find((horse) => horse.id === race.winner_horse)?.name ?? 'No horse'} wins`
  return (
    <li className="min-w-0 border-2 border-accent bg-panel">
      <Link to={`/race/${race.id}`} className="block">
        <div className="flex items-center gap-4 p-4">
          <div className="border-2 border-line bg-bg p-2">
            <Glyph name={race.task} px={4} />
          </div>
          <div className="min-w-0 grow">
            <p className="truncate font-pixel text-[34px] leading-none">{ROOMS[race.task] ?? race.task}</p>
            <p className="mt-2 text-[14px] text-muted">Race {race.id}</p>
            <p className={`mt-1 flex items-center gap-2 font-pixel text-[24px] leading-none ${running ? 'text-accent' : ''}`}>
              {running && <i className="size-3 bg-accent motion-safe:animate-blink" />}
              {status}
            </p>
          </div>
        </div>
        {/* The field as a pack: on a narrow card the horses overlap, and the left horse is in front. */}
        <div className="flex border-y-2 border-line px-4 pb-1 pt-3" style={grass(2)}>
          {horses.map((horse, i) => (
            <div key={horse.id} className="relative min-w-0 max-w-28 flex-1 last:flex-none" style={{ zIndex: horses.length - i }}>
              <Horse id={horse.id} scale={2} running={running} idle />
            </div>
          ))}
        </div>
        <div className="flex justify-between gap-4 p-4 text-[14px]">
          <p className="shrink-0">Pool {oats(pool)} Oats</p>
          {favorite && favoriteOdds > 0 && race.status !== 'settled' && (
            <p className="truncate text-muted">
              {favorite.name} {odds(favoriteOdds)}
            </p>
          )}
        </div>
      </Link>
      {children && <div className="border-t-2 border-line p-4">{children}</div>}
    </li>
  )
}
