import { useState } from 'react'
import RaceCard from '../components/RaceCard'
import { useNow, useRaces } from '../lib/queries'

const TABS = ['Popular', 'Latest'] as const

// The race list. Popular puts the races that a player can still bet on first, then the most Oats of players. Latest puts the newest first.
export default function Home() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Popular')
  const { data, error } = useRaces()
  const now = useNow()
  // The list arrives newest first, and the sort keeps that order for equal pools.
  const over = (status: string) => Number(status === 'settled')
  const races =
    tab === 'Latest' ? data : data?.slice().sort((a, b) => over(a.race.status) - over(b.race.status) || b.pool - a.pool)
  return (
    <main>
      <div className="mt-6 flex gap-2">
        {TABS.map((name) => (
          <button
            key={name}
            aria-pressed={tab === name}
            onClick={() => setTab(name)}
            className="h-11 border-2 border-text px-4 font-pixel text-[24px] leading-none aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent"
          >
            {name}
          </button>
        ))}
      </div>
      {error && <p className="mt-6">{error.message}</p>}
      {races?.length === 0 && <p className="mt-6 text-muted">No race yet.</p>}
      <ul className="mt-4 grid gap-4 lg:grid-cols-2">
        {races?.map((summary) => <RaceCard key={summary.race.id} summary={summary} now={now} />)}
      </ul>
    </main>
  )
}
