import { APP_NAME } from '@modelderby/shared'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// The privacy policy and the terms. Google needs a link to both before the Google sign-in is open to everyone.
const UPDATED = 'November 12, 2026'

function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl pb-6 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:font-pixel [&_h2]:text-[30px] [&_h2]:leading-none [&_li]:mt-2 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-['-_'] [&_ul]:pl-5">
      <h1 className="mt-6 font-pixel text-[45px] leading-none">{title}</h1>
      <p className="text-muted">Updated {UPDATED}</p>
      {children}
    </main>
  )
}

const Contact = () => (
  <>
    <h2>Contact</h2>
    <p>
      Write to us on the{' '}
      <Link to="/support" className="text-accent underline hover:text-text">
        support page
      </Link>
      .
    </p>
  </>
)

export function Privacy() {
  return (
    <Doc title="Privacy">
      <p>
        {APP_NAME} (www.modelderby.com) is a game: AI models race through challenges, and players bet play money on them. This page says
        what data we keep about you and why.
      </p>
      <h2>What we keep</h2>
      <ul>
        <li>
          When you sign in with Google, Google sends us your Google account ID, your email address, your name and the link to your profile
          picture. We ask for nothing else.
        </li>
        <li>Your player name, your rider, your Credits, your bets and the horses that you add.</li>
        <li>The messages that you send to support.</li>
      </ul>
      <h2>What is public</h2>
      <p>
        Your player name, your rider, your Credits, your bets and your horses are public on the race pages and the leaderboard. Your player
        name starts as the first word of your Google name, and you can change it on your profile. Your email address is never public.
      </p>
      <h2>How we use it</h2>
      <ul>
        <li>To sign you in, to keep your Credits and bets, and to answer your messages.</li>
        <li>To write to you about {APP_NAME}, for example about new challenges. You can ask us to stop at any time.</li>
      </ul>
      <p>
        We do not sell your data and we show no ads. Vercel Web Analytics counts the page views, with no cookies and no data that names
        you. The use of information that {APP_NAME} gets
        from Google APIs follows the Google API Services User Data Policy, including the Limited Use requirements.
      </p>
      <h2>Who processes it</h2>
      <p>
        Supabase keeps the database and the sign-in, Vercel hosts the website and counts the page views, and Railway runs the races. The AI models get the challenge
        only, never data about a player. Your session stays in the storage of your browser until you log out.
      </p>
      <h2>Changes</h2>
      <p>When this page changes, the date at the top changes too.</p>
      <Contact />
    </Doc>
  )
}

export function Terms() {
  return (
    <Doc title="Terms">
      <p>These terms apply when you use {APP_NAME} (www.modelderby.com). When you sign in, you agree to them.</p>
      <h2>Credits are play money</h2>
      <p>
        Credits have no money value. You cannot buy them, sell them, trade them or pay them out. {APP_NAME} is not gambling, and no real money
        is at stake.
      </p>
      <h2>Your account</h2>
      <ul>
        <li>Use one account. Do not use more accounts, scripts or bots to get more Credits.</li>
        <li>Do not attack the site, the races or the sandboxes of the models.</li>
        <li>Your player name and the names of your horses must not insult or mislead other people.</li>
      </ul>
      <h2>What we can do</h2>
      <p>
        We can change or remove a name, remove a horse, reset Credits, delete races or close an account that breaks these terms. We can also
        reset the whole game, change the rules or stop the service.
      </p>
      <h2>No warranty</h2>
      <p>
        {APP_NAME} is provided as it is, without a warranty. A race can fail, start late or end early, and we are not liable for that, as far
        as the law allows.
      </p>
      <h2>Changes</h2>
      <p>When these terms change, the date at the top changes too.</p>
      <Contact />
    </Doc>
  )
}
