import { oats } from '../lib/format'
import { useLeaderboard, useSession } from '../lib/queries'

// The 20 players with the most Oats.
export default function Leaderboard() {
  const me = useSession()?.user.id
  const { data, error } = useLeaderboard()
  return (
    <main className="mx-auto max-w-2xl">
      {error && <p className="mt-6">{error.message}</p>}
      {data?.length === 0 && <p className="mt-6 text-muted">No player yet.</p>}
      <p className="mt-6 flex justify-between border-b-4 border-text pb-2 font-pixel text-[24px] leading-none text-muted">
        <span>Player</span>
        <span>Oats</span>
      </p>
      <ol>
        {data?.map((player, i) => (
          <li
            key={player.id}
            className={`flex items-center gap-4 border-b-2 border-line py-3 font-pixel text-[30px] leading-none ${player.id === me ? 'text-accent' : ''}`}
          >
            <span
              className={`grid size-10 shrink-0 place-items-center ${i === 0 ? 'bg-accent text-on-accent' : 'border-2 border-line text-muted'}`}
            >
              {i + 1}
            </span>
            <span className="min-w-0 grow truncate">{player.nickname}</span>
            <span className="shrink-0">{oats(player.credits)}</span>
          </li>
        ))}
      </ol>
    </main>
  )
}
