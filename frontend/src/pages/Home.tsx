import { useState } from 'react'
import Empty from '../components/Empty'
import FeaturedRace, { FeaturedSkeleton } from '../components/FeaturedRace'
import RaceCard, { RaceCardSkeleton } from '../components/RaceCard'
import { useNow, useRaces } from '../lib/queries'

const TABS = ['Popular', 'Latest'] as const
// The filter of the list: the statuses of a race, with the names that the menu shows.
const STATUSES = { open: 'Open', running: 'Running', settled: 'Over' }
// The three buttons of the row must fit at a width of 320 px.
const BUTTON =
  'h-11 border-2 border-text px-3 font-pixel text-[22.5px] leading-none hover:border-accent hover:text-accent lg:px-4 lg:text-[30px]'

// The race list, with one race large on top: a race that runs, or else the first race of the list.
// Popular puts the races that a player can still bet on first, then the most Credits of players. Latest puts the newest first.
export default function Home() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Popular')
  // A race that is over is hidden at first, so the list shows the races that a player can bet on.
  const [hidden, setHidden] = useState(['settled'])
  const [menu, setMenu] = useState(false)
  const { data: all, error } = useRaces()
  // The Arena races are on the Arena page only.
  const data = all?.filter(({ race }) => !race.arena && !hidden.includes(race.status))
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
            className={`${BUTTON} aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent`}
          >
            {name}
          </button>
        ))}
        <div className="relative ml-auto" onKeyDown={(event) => event.key === 'Escape' && setMenu(false)}>
          <button
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
            className={`${BUTTON} aria-expanded:border-accent aria-expanded:text-accent`}
          >
            Filter
          </button>
          {menu && (
            <>
              {/* A click outside the menu closes it. */}
              <div className="fixed inset-0 z-1" onClick={() => setMenu(false)} />
              <div role="menu" className="absolute right-0 top-full z-1 mt-2 w-48 border-2 border-text bg-panel">
                {Object.entries(STATUSES).map(([status, name]) => (
                  <button
                    key={status}
                    role="menuitemcheckbox"
                    aria-checked={!hidden.includes(status)}
                    onClick={() => setHidden(hidden.includes(status) ? hidden.filter((each) => each !== status) : [...hidden, status])}
                    className="group flex h-12 w-full items-center gap-3 px-4 font-pixel text-[30px] leading-none hover:text-accent"
                  >
                    <i className="size-4 border-2 border-text group-aria-checked:border-accent group-aria-checked:bg-accent" />
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-6">{error.message}</p>}
      {races?.length === 0 && <Empty>No race here</Empty>}
      {!all && !error && <FeaturedSkeleton />}
      {featured && <FeaturedRace id={featured.race.id} now={now} />}
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!all && !error && [0, 1, 2].map((n) => <RaceCardSkeleton key={n} />)}
        {races?.map((summary) => summary !== featured && <RaceCard key={summary.race.id} summary={summary} now={now} />)}
      </ul>
    </main>
  )
}
