import type { Player } from '@modelderby/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import Rider from '../components/Rider'
import { grass } from '../components/Track'
import { setProfile, signOut, usePlayer, useSession } from '../lib/queries'
import { PARTS, riderOf } from '../lib/rider'

const STEP = 'grid size-12 shrink-0 place-items-center border-2 border-text font-pixel text-[30px] leading-none hover:border-accent hover:text-accent'

function Editor({ player }: { player: Player }) {
  const client = useQueryClient()
  const [name, setName] = useState(player.nickname)
  const [rider, setRider] = useState(() => riderOf(player))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const changed = name.trim() !== player.nickname || rider.join() !== riderOf(player).join()
  // The size of one sprite pixel of the rider.
  const px = window.innerWidth < 640 ? 8 : 12

  return (
    <form
      className="gap-6 sm:grid sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault()
        setBusy(true)
        setError('')
        setProfile(name, rider)
          // The header and the leaderboard show the name and the rider.
          .then(() => Promise.all([client.invalidateQueries({ queryKey: ['player'] }), client.invalidateQueries({ queryKey: ['leaderboard'] })]))
          .catch((failure: Error) => setError(failure.message))
          .finally(() => setBusy(false))
      }}
    >
      {/* On a phone, the rider stays below the header, so the player sees each change. */}
      <div
        className="sticky top-[calc(env(safe-area-inset-top)+60px)] z-1 mb-6 grid place-items-center border-2 border-accent p-3 sm:static sm:mb-0 sm:p-6"
        style={grass(px)}
      >
        <Rider rider={rider} scale={px} />
      </div>
      <div>
        <input
          aria-label="Public name"
          placeholder="Public name"
          value={name}
          maxLength={24}
          required
          onChange={(event) => setName(event.target.value)}
          className="h-12 w-full border-2 border-text bg-bg px-3 text-[16px] placeholder:text-muted"
        />
        {PARTS.map((part, i) => {
          const step = (by: number) =>
            setRider(rider.map((value, at) => (at === i ? (value + by + part.count) % part.count : value)))
          return (
            <div key={part.name} className="mt-3 flex items-center">
              <button type="button" aria-label={`Previous ${part.name}`} onClick={() => step(-1)} className={STEP}>
                &lt;
              </button>
              <p className="grow text-center font-pixel text-[30px] leading-none">{part.name}</p>
              <button type="button" aria-label={`Next ${part.name}`} onClick={() => step(1)} className={STEP}>
                &gt;
              </button>
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => setRider(PARTS.map((part) => Math.floor(Math.random() * part.count)))}
          className="mt-6 h-12 w-full border-2 border-text font-pixel text-[30px] leading-none hover:border-accent hover:text-accent"
        >
          Randomize
        </button>
        <button
          disabled={busy || !changed}
          className="mt-3 h-14 w-full bg-accent font-pixel text-[30px] leading-none text-on-accent hover:bg-accent-deep disabled:bg-line disabled:text-muted"
        >
          {changed ? 'Save' : 'Saved'}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-[14px]">
            {error}
          </p>
        )}
        {/* On a wide screen, the account menu has the log out. */}
        <button type="button" onClick={signOut} className="mt-3 h-12 w-full border-2 border-line font-pixel text-[30px] leading-none text-muted hover:border-accent hover:text-accent lg:hidden">
          Log out
        </button>
      </div>
    </form>
  )
}

// A player sets the public name and builds the rider. The other players see both on the leaderboard.
export default function Profile() {
  const session = useSession()
  const { data: player } = usePlayer()
  if (session === null) return <Navigate to="/signin" state={{ from: '/profile' }} replace />
  return <main className="mx-auto max-w-2xl pt-6">{player && <Editor player={player} />}</main>
}
