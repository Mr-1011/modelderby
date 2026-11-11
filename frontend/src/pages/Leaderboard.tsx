import { oats } from '../lib/format'
import { useLeaderboard, useSession } from '../lib/queries'

// The 20 players with the most Oats.
export default function Leaderboard() {
  const me = useSession()?.user.id
  const { data, error } = useLeaderboard()
  return (
    <main>
      {error && <p className="mt-6">{error.message}</p>}
      {data?.length === 0 && <p className="mt-6 text-muted">No player yet.</p>}
      <ol className="mt-2">
        {data?.map((player, i) => (
          <li
            key={player.id}
            className={`flex items-baseline justify-between gap-4 border-b-2 border-line py-4 font-pixel text-[30px] leading-none ${player.id === me ? 'text-accent' : ''}`}
          >
            <span className="truncate">
              <span className="text-muted">{i + 1}</span> {player.nickname}
            </span>
            <span className="shrink-0">{oats(player.credits)} Oats</span>
          </li>
        ))}
      </ol>
    </main>
  )
}
