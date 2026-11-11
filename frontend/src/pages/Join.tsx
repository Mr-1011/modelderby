import { APP_NAME } from '@horserace/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import Rider from '../components/Rider'
import { grass } from '../components/Track'
import { joinAsGuest, setProfile, useSession } from '../lib/queries'
import { PARTS } from '../lib/rider'

// The name field starts with a famous jockey (Furkan, 2026-11-10), so a guest can click Create at once.
// Two guests can get the same name: there is no check, and a guest can change the name.
const JOCKEYS = [
  'Frankie Dettori', 'Lester Piggott', 'Bill Shoemaker', 'Eddie Arcaro', 'Laffit Pincay Jr.', 'Angel Cordero Jr.',
  'Pat Day', 'Jerry Bailey', 'Mike Smith', 'Gary Stevens', 'Chris McCarron', 'Kent Desormeaux',
  'Victor Espinoza', 'John Velazquez', 'Javier Castellano', 'Irad Ortiz Jr.', 'Joel Rosario', 'Flavien Prat',
  'Ryan Moore', 'William Buick', 'Oisin Murphy', 'Tom Marquand', 'Hollie Doyle', 'Rachael Blackmore',
  'Julie Krone', 'Rosie Napravnik', 'Tony McCoy', 'Ruby Walsh', 'Kieren Fallon', 'Pat Eddery',
  'Willie Carson', 'Steve Cauthen', 'Ron Turcotte', 'Red Pollard', 'George Woolf', 'Johnny Longden',
  'Russell Baze', 'Yutaka Take', 'Christophe Soumillon', 'Olivier Peslier', 'Damien Oliver', 'Glen Boss',
  'Hugh Bowman', 'James McDonald', 'Joao Moreira', 'Zac Purton', 'Calvin Borel', 'Mickael Barzalona',
  'Christophe Lemaire', 'Fred Archer', 'Gordon Richards', 'Isaac Murphy', 'Jimmy Winkfield', 'Michelle Payne',
]
const randomName = () => JOCKEYS[Math.floor(Math.random() * JOCKEYS.length)]
const randomRider = () => PARTS.map((part) => Math.floor(Math.random() * part.count))

const STEP = 'grid size-10 shrink-0 place-items-center border-2 border-text font-pixel text-[30px] leading-none hover:border-accent hover:text-accent'

// The page behind the QR codes: a guest account without Google, with a rider name and a rider, as on the profile page.
// /join?race=7 sends the new player to race 7.
// The account lives only in this browser. A player who is signed in goes on at once.
export default function Join() {
  const session = useSession()
  const race = useSearchParams()[0].get('race') ?? ''
  const to = /^\d+$/.test(race) ? `/race/${race}` : '/'
  const client = useQueryClient()
  const [name, setName] = useState(randomName)
  const [rider, setRider] = useState(randomRider)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // A new guest stays here until the rider is saved.
  if (session && !busy) return <Navigate to={to} replace />
  // The session still loads, so the form must not flash for a player who is signed in.
  if (session === undefined) return null
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-4">
      <Link to="/" className="font-pixel text-[30px] leading-none hover:text-accent">
        {APP_NAME}
      </Link>
      <form
        className="mt-4 border-2 border-accent bg-panel"
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setError('')
          joinAsGuest(name.trim())
            .then(() => setProfile(name.trim(), rider))
            .then(() => client.invalidateQueries({ queryKey: ['player'] }))
            .catch((failure: Error) => setError(failure.message))
            // With a session, the end of busy sends the player on.
            .finally(() => setBusy(false))
        }}
      >
        <div className="grid place-items-center p-4" style={grass(6)}>
          <Rider rider={rider} scale={6} />
        </div>
        <div className="p-6">
          <h1 className="font-pixel text-[45px] leading-none">Build your rider</h1>
          <div className="mt-6 flex gap-2">
            <input
              aria-label="Rider name"
              value={name}
              maxLength={24}
              required
              onChange={(event) => setName(event.target.value)}
              className="h-12 min-w-0 grow border-2 border-text bg-bg px-3 text-[16px]"
            />
            <button
              type="button"
              onClick={() => setName(randomName())}
              className="h-12 shrink-0 border-2 border-text px-3 font-pixel text-[30px] leading-none hover:border-accent hover:text-accent"
            >
              Roll
            </button>
          </div>
          {PARTS.map((part, i) => {
            const step = (by: number) => setRider(rider.map((value, at) => (at === i ? (value + by + part.count) % part.count : value)))
            return (
              <div key={part.name} className="mt-2 flex items-center">
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
            onClick={() => setRider(randomRider())}
            className="mt-2 h-10 w-full border-2 border-text font-pixel text-[30px] leading-none hover:border-accent hover:text-accent"
          >
            Randomize
          </button>
          <button
            disabled={busy || !name.trim()}
            className="mt-4 h-12 w-full bg-accent font-pixel text-[30px] leading-none text-on-accent hover:bg-accent-deep disabled:bg-line disabled:text-muted"
          >
            Create
          </button>
          {error && (
            <p role="alert" className="mt-4 text-[15px]">
              {error}
            </p>
          )}
          <p className="mt-4 text-[15px] leading-relaxed">
            You start with 1,000 Credits. Credits are not real money. This account stays in this browser.
          </p>
        </div>
      </form>
      <Link to="/signin" state={{ from: to }} className="mt-6 text-[15px] underline underline-offset-4 hover:text-accent">
        Sign in with Google
      </Link>
    </main>
  )
}
