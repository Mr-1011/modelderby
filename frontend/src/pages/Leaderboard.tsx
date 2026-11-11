import Horse from '../components/Horse'
import { grass } from '../components/Track'
import { oats } from '../lib/format'
import { useLeaderboard, useSession } from '../lib/queries'

// The 10 players with the most Oats. Each player has a rider of their own, drawn from the player id.
export default function Leaderboard() {
  const me = useSession()?.user.id
  const { data, error } = useLeaderboard()
  // The size of one sprite pixel of the rider.
  const px = window.innerWidth < 640 ? 1 : 2
  return (
    <main className="mx-auto max-w-2xl">
      {error && <p className="mt-6">{error.message}</p>}
      {data?.length === 0 && <p className="mt-6 text-muted">No player yet.</p>}
      <p className="mt-6 flex justify-between border-b-4 border-text pb-2 text-[13px] text-muted">
        <span>Top 10 players</span>
        <span>Oats</span>
      </p>
      <ol>
        {data?.map((player, i) => (
          <li key={player.id} className={`flex items-center gap-3 border-b-2 border-line py-3 ${player.id === me ? 'text-accent' : ''}`}>
            <span className="w-8 shrink-0 font-pixel text-[30px] leading-none text-muted">{i + 1}</span>
            <div className="shrink-0 px-1 pt-2" style={grass(px)}>
              <Horse id={player.id} scale={px} idle />
            </div>
            <div className="min-w-0 grow">
              <p className="truncate font-pixel text-[30px] leading-none">{player.nickname}</p>
              <p className="mt-1 text-[13px] text-muted">
                {player.invested > 0 ? `${oats(player.invested)} Oats in bets` : 'No open bet'}
              </p>
            </div>
            <span className="shrink-0 font-pixel text-[30px] leading-none">{oats(player.credits)}</span>
          </li>
        ))}
      </ol>
    </main>
  )
}
