import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { oats, odds } from '../lib/format'
import type { RaceSummary } from '../lib/queries'
import { BLURBS, ROOMS, statusOf } from '../lib/race'
import Glyph from './Glyph'

// One race in a list: the image of its challenge, one line about it, its favorite or its winner, and its status.
// It links to the race page.
export default function RaceCard({ summary, now, children }: { summary: RaceSummary; now: number; children?: ReactNode }) {
  const { race, horses, pool, favorite, favoriteOdds } = summary
  const settled = race.status === 'settled'
  const winner = horses.find((horse) => horse.id === race.winner_horse)
  return (
    <li className="min-w-0 border-2 border-accent bg-panel hover:outline-2 hover:outline-accent">
      <Link to={`/race/${race.id}`} className="block">
        <div className="grid place-items-center border-b-2 border-line bg-bg py-6">
          <Glyph name={race.task} px={5} />
        </div>
        <div className="p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="truncate font-pixel text-[30px] leading-none">{ROOMS[race.task] ?? race.task}</h2>
            <p className="shrink-0 text-[13px] text-muted">
              Race {race.id}, {horses.length} horses
            </p>
          </div>
          <p className="mt-2 line-clamp-2 h-10 text-[13px] leading-5 text-muted">{BLURBS[race.task]}</p>
          {/* Each horse has odds from the house seed, so a race with no bet of a player shows its favorite, not an empty pool. */}
          <div className="mt-4 border-y-2 border-line py-3">
            <p className="text-[12px] text-muted">{settled ? 'Winner' : 'Favorite'}</p>
            <p className="mt-1 flex items-baseline justify-between gap-3 font-pixel text-[30px] leading-none">
              <span className="truncate">{(settled ? winner : favorite)?.name ?? '-'}</span>
              {!settled && favoriteOdds > 0 && <span className="shrink-0">{odds(favoriteOdds)}</span>}
            </p>
          </div>
          <p className="mt-3 flex items-baseline justify-between gap-3 font-pixel text-[30px] leading-none">
            <span className={`flex min-w-0 items-center gap-2 ${settled ? 'text-muted' : 'text-accent'}`}>
              {race.status === 'running' && <i className="size-3 shrink-0 bg-accent motion-safe:animate-blink" />}
              <span className="truncate">{statusOf(race, now)}</span>
            </span>
            {pool > 0 && <span className="shrink-0 text-[22.5px] text-muted">Pool {oats(pool)}</span>}
          </p>
        </div>
      </Link>
      {children && <div className="border-t-2 border-line p-4">{children}</div>}
    </li>
  )
}
