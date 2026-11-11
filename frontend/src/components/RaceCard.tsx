import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { clock, oats, odds } from '../lib/format'
import type { RaceSummary } from '../lib/queries'
import { RACE_MS, ROOMS } from '../lib/race'
import Horse from './Horse'

// One race in a list: its room, its status, its horses, its pool and its favorite. It links to the race page.
export default function RaceCard({ summary, now, children }: { summary: RaceSummary; now: number; children?: ReactNode }) {
  const { race, horses, pool, favorite, favoriteOdds } = summary
  const status =
    race.status === 'open'
      ? `Starts in ${clock(Date.parse(race.countdown_ends_at ?? race.opens_at) - now + 999)}`
      : race.status === 'running'
        ? `${clock(now - Date.parse(race.started_at!))} / ${clock(RACE_MS)}`
        : `${horses.find((horse) => horse.id === race.winner_horse)?.name ?? 'No horse'} wins`
  return (
    <li className="border-b-2 border-line py-5">
      <Link to={`/race/${race.id}`} className="block">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-pixel text-[30px] leading-none">
            Race {race.id} <span className="text-muted">{ROOMS[race.task] ?? race.task}</span>
          </p>
          <p className={`shrink-0 text-[14px] ${race.status === 'running' ? 'text-accent' : ''}`}>{status}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-x-2 bg-accent px-3 py-2">
          {horses.map((horse) => (
            <Horse key={horse.id} id={horse.id} scale={2} running={race.status === 'running'} />
          ))}
        </div>
        <div className="mt-3 flex justify-between gap-4 text-[14px]">
          <p>{oats(pool)} Oats in the pool</p>
          {favorite && favoriteOdds > 0 && race.status !== 'settled' && (
            <p className="truncate text-muted">
              {favorite.name} {odds(favoriteOdds)}
            </p>
          )}
        </div>
      </Link>
      {children}
    </li>
  )
}
