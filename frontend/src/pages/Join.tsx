import { APP_NAME } from '@horserace/shared'
import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import Horse from '../components/Horse'
import { grass } from '../components/Track'
import { joinAsGuest, useSession } from '../lib/queries'

// A rider name is one random first name and one random last name, so it is not the name of a real person.
const FIRST = [
  'Lucky', 'Dusty', 'Rusty', 'Buck', 'Lefty', 'Red', 'Slim', 'Tex', 'Skip', 'Ace', 'Duke', 'Gus',
  'Ned', 'Hank', 'Billie', 'Dot', 'Mabel', 'Pearl', 'Ruby', 'Winnie', 'Clem', 'Otis', 'Jeb', 'Lottie',
]
const LAST = [
  'Pickett', 'Marlow', 'Saddler', 'Furlong', 'Stirrup', 'Canter', 'Whitlock', 'Paddock', 'Bridle', 'Gallop',
  'Oatfield', 'Longshot', 'Farrier', 'Withers', 'Haybale', 'Blinkers', 'Trotter', 'Homestretch', 'Fetlock', 'Hotwalker',
]
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)]
const randomName = () => `${pick(FIRST)} ${pick(LAST)}`

// The page behind the QR codes: a guest account without Google. /join?race=7 sends the new player to race 7.
// The account lives only in this browser. A player who is signed in goes on at once.
export default function Join() {
  const session = useSession()
  const race = useSearchParams()[0].get('race') ?? ''
  const to = /^\d+$/.test(race) ? `/race/${race}` : '/'
  const [name, setName] = useState(randomName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (session) return <Navigate to={to} replace />
  // The session still loads, so the form must not flash for a player who is signed in.
  if (session === undefined) return null
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-4">
      <Link to="/" className="font-pixel text-[30px] leading-none">
        {APP_NAME}
      </Link>
      <form
        className="mt-4 border-2 border-accent bg-panel"
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setError('')
          // The session change sends the player on, so there is nothing to do after a success.
          joinAsGuest(name.trim()).catch((failure: Error) => {
            setError(failure.message)
            setBusy(false)
          })
        }}
      >
        <div className="flex items-end justify-between px-4 pb-1 pt-5" style={grass(2)}>
          <Horse id="h2" scale={2} idle />
          <Horse id="h5" scale={2} idle />
          <Horse id="h6" scale={2} idle />
        </div>
        <div className="p-6">
          <h1 className="font-pixel text-[45px] leading-none">Pick your rider name</h1>
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
              className="h-12 shrink-0 border-2 border-text px-3 font-pixel text-[30px] leading-none"
            >
              Roll
            </button>
          </div>
          <button
            disabled={busy || !name.trim()}
            className="mt-4 h-12 w-full bg-accent font-pixel text-[30px] leading-none text-on-accent disabled:bg-line disabled:text-muted"
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
      <Link to="/signin" state={{ from: to }} className="mt-6 text-[15px] underline underline-offset-4">
        Sign in with Google
      </Link>
    </main>
  )
}
