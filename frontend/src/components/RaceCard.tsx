import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { clock, oats, odds } from '../lib/format'
import type { RaceSummary } from '../lib/queries'
import { RACE_MS, ROOMS } from '../lib/race'
import Horse from './Horse'

// One race in a list: its room, its status, its horses, its pool and its favorite. It links to the race page.
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
    <li className="min-w-0 border-2 border-line bg-panel hover:border-text">
      <Link to={`/race/${race.id}`} className="block p-4">
        <div className="flex items-baseline justify-between gap-4">
          <p className="truncate font-pixel text-[30px] leading-none">
            Race {race.id} <span className="text-muted">{ROOMS[race.task] ?? race.task}</span>
          </p>
          <p className={`flex shrink-0 items-center gap-2 font-pixel text-[20px] leading-none ${running ? 'text-accent' : 'text-muted'}`}>
            {running && <i className="size-3 bg-accent motion-safe:animate-blink" />}
            {status}
          </p>
        </div>
        {/* The field as a pack: on a narrow card the horses overlap, and the left horse is in front. */}
        <div className="mt-3 flex bg-accent px-3 py-2">
          {horses.map((horse, i) => (
            <div key={horse.id} className="relative min-w-0 max-w-28 flex-1 last:flex-none" style={{ zIndex: horses.length - i }}>
              <Horse id={horse.id} scale={2} running={running} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between gap-4 text-[14px]">
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
