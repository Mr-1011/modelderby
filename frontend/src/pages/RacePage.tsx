import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import EntryDialog from '../components/EntryDialog'
import OddsChart from '../components/OddsChart'
import { oats } from '../lib/format'
import { placeBet, useModels, useNow, usePlayer, useRace, useSession } from '../lib/queries'
import { MAX_HORSES } from './Arena'
import { PhoneView } from './Phone'

// A free place in the lineup of an open race. A player adds one OpenRouter model as a horse, and each player can bet on it.
function AddHorse({ race, signedIn }: { race: number; signedIn: boolean }) {
  const { data: models } = useModels()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  return (
    <li className="min-w-0">
      <button
        onClick={() => (signedIn ? setOpen(true) : navigate('/signin', { state: { from: pathname } }))}
        className="grid h-full min-h-40 w-full place-content-center justify-items-center gap-2 border-2 border-dashed border-line text-muted hover:border-accent hover:text-accent"
      >
        <span className="font-pixel text-[45px] leading-none">+</span>
        <span className="font-pixel text-[22.5px] leading-none lg:text-[30px]">Add a horse</span>
      </button>
      {open && models && <EntryDialog race={race} models={models} onClose={() => setOpen(false)} />}
    </li>
  )
}

// One race with live data: the race view with the odds chart on top, then the result.
// The page is open without an account. Only a bet needs one.
export default function RacePage() {
  const id = Number(useParams().id)
  const session = useSession()
  const { data: player } = usePlayer()
  const { data: view, error } = useRace(id)
  const client = useQueryClient()
  const now = useNow()
  const [alert, setAlert] = useState('')

  if (error) return <p className="py-6">{error.message}</p>
  // The parts have the heights of the page of an open race, so the page does not move when the race arrives.
  if (!view || session === undefined || (session && !player))
    return (
      <div role="status" aria-label="Loading" className="motion-safe:animate-load">
        <div className="flex h-[192px] items-start gap-6 py-6 lg:h-[144px] lg:items-center">
          <div className="size-16 shrink-0 bg-line lg:size-24" />
          <div className="min-w-0 grow">
            <div className="h-[30px] w-48 max-w-full bg-line lg:h-[45px] lg:w-72" />
            <div className="mt-3 h-3 w-64 max-w-full bg-line lg:w-96" />
          </div>
        </div>
        <div className="h-[296px] lg:h-[282px]">
          <div className="h-[30px] w-48 bg-line" />
          <div className="mt-3 h-[160px] border-2 border-line lg:h-[240px] lg:w-2/3" />
        </div>
        <ol className="grid grid-cols-2 gap-3 pt-6 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <li key={n} className="h-[264.5px] border-2 border-line bg-panel lg:h-[281px]" />
          ))}
        </ol>
      </div>
    )

  const { race } = view
  const mine = view.bets.filter((bet) => bet.player_id === session?.user.id)
  const staked = mine.reduce((sum, bet) => sum + bet.amount, 0)
  const paid = mine.reduce((sum, bet) => sum + (bet.payout ?? 0), 0)
  // The same rules as the database: the race is open, a place is free, and this player has no horse in it.
  // A race that is not ready waits for its first player, so its countdown does not close the entries.
  const canAdd =
    race.status === 'open' &&
    (!race.ready || Date.parse(race.countdown_ends_at ?? race.opens_at) > now) &&
    view.lanes.length < MAX_HORSES &&
    !view.lanes.some((lane) => lane.horse.submitted_by === session?.user.id)
  return (
    <>
      <PhoneView
        view={view}
        stakes={view}
        add={canAdd && <AddHorse race={id} signedIn={!!session} />}
        chart={(active, onActive) => (
          <OddsChart
            view={view}
            end={Date.parse(race.betting_closed_at ?? race.ended_at ?? '') || now}
            active={active}
            onActive={onActive}
          />
        )}
        player={player ?? null}
        bets={mine
          .map((bet) => ({ horse: bet.outcome, market: bet.market, amount: bet.amount, payout: bet.payout }))
          .reverse()}
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
      <section className="*:max-w-md">
        {race.status === 'settled' && mine.length > 0 && (
          <p className="mt-8 bg-accent p-4 font-pixel text-[30px] leading-none text-on-accent">
            {paid >= staked ? `You won ${oats(paid - staked)} Credits` : `You lost ${oats(staked - paid)} Credits`}
          </p>
        )}
        {race.seed_revealed && <p className="mt-6 break-all text-[13px] text-muted">Seed of this race: {race.seed_revealed}</p>}
      </section>
      {alert && (
        <button role="alert" onClick={() => setAlert('')} className="fixed inset-x-0 bottom-0 z-20 bg-text p-4 text-left text-bg">
          {alert}
        </button>
      )}
    </>
  )
}
