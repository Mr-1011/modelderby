import { APP_NAME } from '@modelderby/shared'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { oats } from '../lib/format'
import { signOut, usePlayer, useSession } from '../lib/queries'
import { riderOf } from '../lib/rider'
import Rider from './Rider'
import SignInLink from './SignInLink'
import { grass } from './Track'

const TAB =
  'grid h-14 grow place-items-center px-1 font-pixel text-[22.5px] leading-none text-muted hover:text-text aria-[current=page]:bg-accent aria-[current=page]:text-on-accent lg:grow-0 lg:px-5 lg:text-[30px]'

// The header with the account and the main pages, the same on each page. Only the board has its own header.
const ITEM = 'block h-12 w-full px-4 text-left font-pixel text-[30px] leading-[48px] hover:bg-accent hover:text-on-accent'

const LINKS = [
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
  ['/support', 'Support'],
]

export default function Shell() {
  const session = useSession()
  const { data: player } = usePlayer()
  const [menu, setMenu] = useState(false)
  const { pathname } = useLocation()
  return (
    // The bottom padding keeps the end of the page above the nav bar of a phone (56 px and its 4 px border).
    <div className="flex min-h-dvh flex-col pb-[calc(60px+env(safe-area-inset-bottom))] lg:pb-0">
      <header className="sticky top-0 z-10 border-b-4 border-text bg-bg pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link to="/" className="whitespace-nowrap font-pixel text-[30px] leading-none hover:text-accent">
            {APP_NAME}
          </Link>
          {/* One nav: a bar at the bottom of a phone, and a part of the header on a wide screen. */}
          <nav className="fixed inset-x-0 bottom-0 flex border-t-4 border-text bg-bg pb-[env(safe-area-inset-bottom)] lg:static lg:border-0 lg:pb-0">
            <NavLink to="/" className={TAB}>
              Races
            </NavLink>
            <NavLink to="/leaderboard" className={TAB}>
              Leaderboard
            </NavLink>
            {/* On a phone, the profile is a tab. On a wide screen, the account menu has it. */}
            <NavLink to="/profile" className={`${TAB} lg:hidden`}>
              Profile
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            {session === null && <SignInLink />}
            {player && (
              <>
                <span className="whitespace-nowrap font-pixel text-[22.5px] leading-none text-accent lg:text-[30px]">
                  {oats(player.credits)} Credits
                </span>
                <div className="relative hidden lg:block" onKeyDown={(event) => event.key === 'Escape' && setMenu(false)}>
                  <button
                    aria-label="Account"
                    aria-expanded={menu}
                    onClick={() => setMenu(!menu)}
                    className="block border-2 border-accent hover:border-text"
                    style={grass(2)}
                  >
                    <Rider rider={riderOf(player)} scale={2} />
                  </button>
                  {menu && (
                    <>
                      {/* A click outside the menu closes it. */}
                      <div className="fixed inset-0" onClick={() => setMenu(false)} />
                      <div className="absolute right-0 top-full mt-2 w-44 border-2 border-text bg-panel">
                        <Link to="/profile" onClick={() => setMenu(false)} className={ITEM}>
                          Profile
                        </Link>
                        <button
                          onClick={() => {
                            setMenu(false)
                            signOut()
                          }}
                          className={`${ITEM} border-t-2 border-line`}
                        >
                          Log out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl grow px-4 pb-10">
        <Outlet />
      </div>
      {/* Only the profile has the footer. It stays at the bottom of the screen, above the nav bar of a phone. */}
      {pathname === '/profile' && (
        <footer className="border-t-2 border-line">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
            {LINKS.map(([to, label]) => (
              <Link key={to} to={to} className="font-pixel text-[22.5px] leading-none text-muted hover:text-accent">
                {label}
              </Link>
            ))}
          </div>
        </footer>
      )}
    </div>
  )
}
