import { useState } from 'react'
import { sendSupport, useSession } from '../lib/queries'

const FIELD = 'w-full border-2 border-text bg-bg px-3 text-[16px] placeholder:text-muted'

// One text to us. A visitor also gives an email, a signed-in player has one in the account.
export default function Support() {
  const session = useSession()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  return (
    <main className="mx-auto max-w-2xl pt-6">
      <h1 className="font-pixel text-[45px] leading-none">Support</h1>
      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setError('')
          sendSupport(message, session ? undefined : email)
            .then(() => {
              setMessage('')
              setSent(true)
            })
            .catch((failure: Error) => setError(failure.message))
            .finally(() => setBusy(false))
        }}
      >
        {/* The session is undefined while it loads, so the email field does not flash for a player. */}
        {session === null && (
          <input
            type="email"
            aria-label="Email"
            placeholder="Email"
            value={email}
            maxLength={254}
            required
            onChange={(event) => setEmail(event.target.value)}
            className={`${FIELD} mb-3 h-12`}
          />
        )}
        <textarea
          aria-label="Message"
          placeholder="Message"
          value={message}
          maxLength={5000}
          required
          rows={8}
          onChange={(event) => {
            setMessage(event.target.value)
            setSent(false)
          }}
          className={`${FIELD} block resize-y py-2`}
        />
        <button
          disabled={busy || session === undefined || !message.trim()}
          className="mt-3 h-14 w-full bg-accent font-pixel text-[30px] leading-none text-on-accent hover:bg-accent-deep disabled:bg-line disabled:text-muted"
        >
          {sent ? 'Sent' : 'Send'}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-[14px]">
            {error}
          </p>
        )}
      </form>
    </main>
  )
}
