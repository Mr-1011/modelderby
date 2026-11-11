import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Login is the Google button and an ID token (Google Identity Services). There is no redirect through Supabase.
type GoogleId = {
  initialize(options: {
    client_id: string
    nonce: string
    use_fedcm_for_prompt: boolean
    callback(response: { credential: string }): void
  }): void
  renderButton(parent: HTMLElement, options: Record<string, string>): void
  prompt(): void
}
declare const google: { accounts: { id: GoogleId } }

// Google puts the hash of the nonce in the ID token, and Supabase compares it with the nonce.
const nonce = crypto.randomUUID()

let ready: Promise<GoogleId> | undefined
const load = () =>
  (ready ??= (async () => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce))
    await new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.onload = resolve
      document.head.append(script)
    })
    google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      nonce: Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(''),
      use_fedcm_for_prompt: true,
      callback: async ({ credential }) => {
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce })
        if (error) alert(error.message)
      },
    })
    return google.accounts.id
  })())

// For a button of our own. The browser can suppress this prompt, so prefer <GoogleButton />.
export const signIn = async () => (await load()).prompt()

// The button of Google. It is an iframe, so only these options change its look. long gives "Sign in with Google".
export default function GoogleButton({ long = false }: { long?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    load().then(
      (id) =>
        ref.current &&
        id.renderButton(ref.current, { theme: 'filled_black', shape: 'rectangular', size: 'large', text: long ? 'signin_with' : 'signin' }),
    )
  }, [long])
  // Without the light color scheme, the iframe gets a white box on a dark page.
  return <div ref={ref} className="h-10 [color-scheme:light]" />
}
