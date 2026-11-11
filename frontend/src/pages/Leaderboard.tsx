import Rider from '../components/Rider'
import { grass } from '../components/Track'
import { oats } from '../lib/format'
import { useLeaderboard, useSession } from '../lib/queries'
import { riderOf } from '../lib/rider'

// The 10 players with the most Credits, each with the public name and the rider from the profile page.
export default function Leaderboard() {
  const me = useSession()?.user.id
  const { data, error } = useLeaderboard()
  return (
    <main className="mx-auto max-w-2xl">
      {error && <p className="mt-6">{error.message}</p>}
      {data?.length === 0 && <p className="mt-6 text-muted">No player yet.</p>}
      <p className="mt-6 flex justify-between border-b-4 border-text pb-2 text-[13px] text-muted">
        <span>Top 10 players</span>
        <span>Credits</span>
      </p>
      <ol>
        {data?.map((player, i) => (
          <li key={player.id} className={`flex items-center gap-3 border-b-2 border-line py-3 ${player.id === me ? 'text-accent' : ''}`}>
            <span className="w-8 shrink-0 font-pixel text-[30px] leading-none text-muted">{i + 1}</span>
            <div className="shrink-0 px-1 pt-1" style={grass(2)}>
              <Rider rider={riderOf(player)} scale={2} />
            </div>
            <div className="min-w-0 grow">
              <p className="truncate font-pixel text-[30px] leading-none">{player.nickname}</p>
              <p className="mt-1 text-[13px] text-muted">
                {player.invested > 0 ? `${oats(player.invested)} Credits in bets` : 'No open bet'}
              </p>
            </div>
            <span className="shrink-0 font-pixel text-[30px] leading-none">{oats(player.credits)}</span>
          </li>
        ))}
      </ol>
    </main>
  )
}
