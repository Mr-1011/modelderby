import { APP_NAME } from '@horserace/shared'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { oats } from '../lib/format'
import { signOut, usePlayer, useSession } from '../lib/queries'
import SignInLink from './SignInLink'

const TAB =
  'grid h-14 place-items-center font-pixel text-[22.5px] leading-none text-muted aria-[current=page]:bg-accent aria-[current=page]:text-on-accent lg:px-5 lg:text-[30px]'

// The header with the account and the main pages, the same on each page. Only the board has its own header.
export default function Shell() {
  const session = useSession()
  const { data: player } = usePlayer()
  return (
    <>
      <header className="sticky top-0 z-10 border-b-4 border-text bg-bg pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link to="/" className="whitespace-nowrap font-pixel text-[30px] leading-none">
            {APP_NAME}
          </Link>
          {/* One nav: a bar at the bottom of a phone, and a part of the header on a wide screen. */}
          <nav className="fixed inset-x-0 bottom-0 grid grid-cols-3 border-t-4 border-text bg-bg pb-[env(safe-area-inset-bottom)] lg:static lg:flex lg:border-0 lg:pb-0">
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
          <div className="ml-auto flex items-center gap-4">
            {session === null && <SignInLink />}
            {player && (
              <>
                <span className="hidden max-w-40 truncate text-[14px] text-muted lg:block">{player.nickname}</span>
                <span className="font-pixel text-[30px] leading-none text-accent">{oats(player.credits)} Oats</span>
                <button onClick={signOut} className="text-[13px] underline underline-offset-4">
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pb-24 lg:pb-10">
        <Outlet />
      </div>
    </>
  )
}
