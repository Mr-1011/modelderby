import { APP_NAME } from '@modelderby/shared'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Footer from '../components/Footer'
import GoogleButton from '../components/GoogleButton'
import Horse from '../components/Horse'
import { grass } from '../components/Track'
import { useSession } from '../lib/queries'

// The one page to sign in and to sign up: a Google account does both. Every other page is open without an account.
export default function SignIn() {
  const session = useSession()
  // The page that sent the player here.
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  if (session) return <Navigate to={from} replace />
  return (
    // The footer is at the bottom of the screen, and the sign-in box is in the middle of the space above it.
    <div className="flex min-h-dvh flex-col pb-[env(safe-area-inset-bottom)]">
      <main className="mx-auto flex w-full max-w-md grow flex-col justify-center p-4">
        <Link to="/" className="font-pixel text-[30px] leading-none hover:text-accent">
          {APP_NAME}
        </Link>
        <div className="mt-4 border-2 border-accent bg-panel">
          <div className="flex items-end justify-between px-4 pb-1 pt-5" style={grass(2)}>
            <Horse id="h3" scale={2} idle />
            <Horse id="h4" scale={2} idle />
            <Horse id="h1" scale={2} idle />
          </div>
          <div className="p-6">
            <h1 className="font-pixel text-[45px] leading-none">Sign in</h1>
            <div className="mt-6">
              <GoogleButton />
            </div>
          </div>
        </div>
        <Link to={from} className="mt-6 text-[15px] underline underline-offset-4 hover:text-accent">
          Back
        </Link>
      </main>
      <Footer width="max-w-md" />
    </div>
  )
}
