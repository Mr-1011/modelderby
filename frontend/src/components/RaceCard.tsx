import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { oats, odds } from '../lib/format'
import type { RaceSummary } from '../lib/queries'
import { BLURBS, ROOMS, statusOf } from '../lib/race'
import Glyph from './Glyph'

// One race in a list: the image of its challenge, one line about it, its numbers and its status.
// It links to the race page.
export default function RaceCard({ summary, now, children }: { summary: RaceSummary; now: number; children?: ReactNode }) {
  const { race, horses, pool, favorite, favoriteOdds } = summary
  const running = race.status === 'running'
  const stats = [
    ['Pool', oats(pool)],
    ['Horses', horses.length],
    ['Favorite', favorite && favoriteOdds > 0 && race.status !== 'settled' ? odds(favoriteOdds) : '-'],
  ]
  return (
    <li className="min-w-0 border-2 border-accent bg-panel">
      <Link to={`/race/${race.id}`} className="block">
        <div className="grid place-items-center border-b-2 border-line bg-bg py-6">
          <Glyph name={race.task} px={5} />
        </div>
        <div className="p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="truncate font-pixel text-[30px] leading-none">{ROOMS[race.task] ?? race.task}</h2>
            <p className="shrink-0 text-[13px] text-muted">Race {race.id}</p>
          </div>
          <p className="mt-2 line-clamp-2 h-10 text-[13px] leading-5 text-muted">{BLURBS[race.task]}</p>
          <dl className="mt-4 grid grid-cols-3 gap-3 border-y-2 border-line py-3">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[12px] text-muted">{label}</dt>
                <dd className="mt-1 font-pixel text-[30px] leading-none">{value}</dd>
              </div>
            ))}
          </dl>
          <p className={`mt-3 flex items-center gap-2 font-pixel text-[30px] leading-none ${race.status === 'settled' ? 'text-muted' : 'text-accent'}`}>
            {running && <i className="size-3 bg-accent motion-safe:animate-blink" />}
            <span className="truncate">{statusOf(race, now, horses.find((horse) => horse.id === race.winner_horse)?.name)}</span>
          </p>
        </div>
      </Link>
      {children && <div className="border-t-2 border-line p-4">{children}</div>}
    </li>
  )
}
