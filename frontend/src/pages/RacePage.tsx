import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { signIn } from '../components/GoogleButton'
import OddsChart from '../components/OddsChart'
import { oats } from '../lib/format'
import { placeBet, useNow, usePlayer, useRace, useSession } from '../lib/queries'
import { PhoneView } from './Phone'

// One race with live data: the phone view of the Design session, then the odds chart and the result.
export default function RacePage() {
  const id = Number(useParams().id)
  const session = useSession()
  const { data: player } = usePlayer()
  const { data: view, error } = useRace(id)
  const client = useQueryClient()
  const now = useNow()
  const [alert, setAlert] = useState('')

  if (error) return <p className="p-4">{error.message}</p>
  if (!view || session === undefined || (session && !player)) return <p className="p-4 text-muted">Loading</p>

  const { race } = view
  const mine = view.bets.filter((bet) => bet.player_id === session?.user.id)
  const staked = mine.reduce((sum, bet) => sum + bet.amount, 0)
  const paid = mine.reduce((sum, bet) => sum + (bet.payout ?? 0), 0)
  return (
    <>
      <PhoneView
        view={view}
        player={player ?? null}
        bets={mine
          .map((bet) => ({ horse: bet.outcome, market: bet.market, amount: bet.amount, payout: bet.payout }))
          .reverse()}
        onJoin={signIn}
        onBet={(horse, market, amount) =>
          placeBet(id, market, horse, amount).then(
            () => {
              client.invalidateQueries({ queryKey: ['race', id] })
              client.invalidateQueries({ queryKey: ['player'] })
            },
            (failure: Error) => setAlert(failure.message),
          )
        }
      />
      {player && (
        <section className="mx-auto max-w-md px-4 pb-10">
          {race.status === 'settled' && mine.length > 0 && (
            <p className="mb-8 bg-accent p-4 font-pixel text-[30px] leading-none text-on-accent">
              {paid >= staked ? `You won ${oats(paid - staked)} Oats` : `You lost ${oats(staked - paid)} Oats`}
            </p>
          )}
          <h2 className="font-pixel text-[28px] leading-none">Chance to win</h2>
          <p className="mb-4 mt-1 text-[14px] text-muted">The share of the Win pool on each horse. A bet moves it.</p>
          <OddsChart view={view} end={Date.parse(race.betting_closed_at ?? race.ended_at ?? '') || now} />
          {race.seed_revealed && <p className="mt-6 break-all text-[13px] text-muted">Seed of this race: {race.seed_revealed}</p>}
        </section>
      )}
      {alert && (
        <button role="alert" onClick={() => setAlert('')} className="fixed inset-x-0 bottom-0 z-20 bg-text p-4 text-left text-bg">
          {alert}
        </button>
      )}
    </>
  )
}
