import { useState } from 'react'
import FeaturedRace from '../components/FeaturedRace'
import RaceCard from '../components/RaceCard'
import { useNow, useRaces } from '../lib/queries'

const TABS = ['Popular', 'Latest'] as const

// The race list, with one race large on top: a race that runs, or else the first race of the list.
// Popular puts the races that a player can still bet on first, then the most Credits of players. Latest puts the newest first.
export default function Home() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Popular')
  const { data, error } = useRaces()
  const now = useNow()
  // The list arrives newest first, and the sort keeps that order for equal pools.
  const over = (status: string) => Number(status === 'settled')
  const races =
    tab === 'Latest' ? data : data?.slice().sort((a, b) => over(a.race.status) - over(b.race.status) || b.pool - a.pool)
  const featured = races?.find((summary) => summary.race.status === 'running') ?? races?.[0]
  return (
    <main>
      <div className="mt-6 flex gap-2">
        {TABS.map((name) => (
          <button
            key={name}
            aria-pressed={tab === name}
            onClick={() => setTab(name)}
            className="h-11 border-2 border-text px-4 font-pixel text-[30px] leading-none aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent"
          >
            {name}
          </button>
        ))}
      </div>
      {error && <p className="mt-6">{error.message}</p>}
      {races?.length === 0 && <p className="mt-6 text-muted">No race yet.</p>}
      {featured && <FeaturedRace id={featured.race.id} now={now} />}
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {races?.map((summary) => summary !== featured && <RaceCard key={summary.race.id} summary={summary} now={now} />)}
      </ul>
    </main>
  )
}
