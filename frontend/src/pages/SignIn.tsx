import { APP_NAME } from '@horserace/shared'
import { Link, Navigate, useLocation } from 'react-router-dom'
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-4">
      <Link to="/" className="font-pixel text-[30px] leading-none">
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
          <p className="mt-4 text-[15px] leading-relaxed">
            You need an account to bet. It is free, and you start with 1,000 Oats. Oats are not real money.
          </p>
          <div className="mt-6">
            <GoogleButton />
          </div>
          <p className="mt-4 text-[13px] text-muted">New here? The same button makes your account.</p>
        </div>
      </div>
      <Link to={from} className="mt-6 text-[15px] underline underline-offset-4">
        Back
      </Link>
    </main>
  )
}
