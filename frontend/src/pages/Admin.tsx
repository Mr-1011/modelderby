import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { clock, oats } from '../lib/format'
import { startRace, useIsAdmin, useNow, useRaces } from '../lib/queries'
import { ROOMS } from '../lib/race'

// The admin starts an open race by hand. The database checks the admin, not this page.
export default function Admin() {
  const { data: admin } = useIsAdmin()
  const { data } = useRaces()
  const client = useQueryClient()
  const now = useNow()
  const [error, setError] = useState('')

  if (admin === undefined) return <p className="mt-6 text-muted">Loading</p>
  if (!admin) return <p className="mt-6">This page is for admins. Sign in with an admin account.</p>

  const live = data?.filter(({ race }) => race.status !== 'settled').reverse()
  return (
    <main className="mx-auto max-w-2xl">
      {error && (
        <p role="alert" className="mt-6">
          {error}
        </p>
      )}
      {live?.length === 0 && <p className="mt-6 text-muted">No open race. The runner opens the next race.</p>}
      <ul className="mt-2">
        {live?.map(({ race, horses, pool }) => {
          const left = Date.parse(race.countdown_ends_at ?? race.opens_at) - now
          return (
            <li key={race.id} className="flex items-center justify-between gap-4 border-b-2 border-line py-4">
              <div className="min-w-0">
                <p className="truncate font-pixel text-[30px] leading-none">
                  Race {race.id} <span className="text-muted">{ROOMS[race.task] ?? race.task}</span>
                </p>
                <p className="mt-1 text-[14px] text-muted">
                  {horses.length} horses, {oats(pool)} Credits,{' '}
                  {race.status === 'running'
                    ? 'runs now'
                    : race.ready
                      ? `starts in ${clock(left + 999)}`
                      : 'waits for the first player'}
                </p>
              </div>
              {race.status === 'open' && (
                <button
                  // In the last 20 seconds the runner builds the room, so a start changes nothing.
                  disabled={race.ready && left < 20_000}
                  onClick={() =>
                    startRace(race.id).then(
                      () => client.invalidateQueries({ queryKey: ['races'] }),
                      (failure: Error) => setError(failure.message),
                    )
                  }
                  className="h-12 shrink-0 bg-accent px-4 font-pixel text-[30px] leading-none text-on-accent hover:bg-accent-deep disabled:bg-line disabled:text-muted"
                >
                  Start now
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
