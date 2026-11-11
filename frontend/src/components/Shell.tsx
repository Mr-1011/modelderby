import { APP_NAME } from '@horserace/shared'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { oats } from '../lib/format'
import { signOut, usePlayer, useSession } from '../lib/queries'
import GoogleButton from './GoogleButton'

const TAB = 'font-pixel text-[26px] leading-none text-muted aria-[current=page]:text-accent'

// The header with the account and the main pages. The race page and the board have their own headers.
export default function Shell() {
  const session = useSession()
  const { data: player } = usePlayer()
  return (
    <div className="mx-auto max-w-3xl px-4 pb-10">
      <header className="border-b-4 border-text pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Link to="/" className="font-pixel text-[34px] leading-none">
            {APP_NAME}
          </Link>
          {session === null && <GoogleButton />}
          {player && (
            <p className="flex items-baseline gap-4">
              <span className="font-pixel text-[34px] leading-none text-accent">{oats(player.credits)} Oats</span>
              <span className="text-[14px] text-muted">{player.nickname}</span>
              <button onClick={signOut} className="text-[14px] underline underline-offset-4">
                Sign out
              </button>
            </p>
          )}
        </div>
        <nav className="mt-4 flex gap-6">
          <NavLink to="/" className={TAB}>
            Races
          </NavLink>
          <NavLink to="/arena" className={TAB}>
            Arena
          </NavLink>
          <NavLink to="/leaderboard" className={TAB}>
            Leaderboard
          </NavLink>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
