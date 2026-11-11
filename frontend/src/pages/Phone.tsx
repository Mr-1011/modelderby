import { APP_NAME, type Horse as HorseRow } from '@horserace/shared'
import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Horse from '../components/Horse'
import Track from '../components/Track'
import { useDemoRace } from '../lib/demo'
import { clock, oats, odds } from '../lib/format'
import { RACE_MS, type RaceView, ROOMS } from '../lib/race'

type Market = 'win' | 'place'
export type Player = { nickname: string; credits: number }
export type MyBet = { horse: string; market: Market; amount: number }

const BUTTON = 'h-14 border-2 border-text font-pixel text-[28px] leading-none disabled:border-line disabled:text-muted'
const PRIMARY = 'h-14 w-full bg-accent font-pixel text-[30px] leading-none text-on-accent disabled:bg-line disabled:text-muted'

function Join({ onJoin }: { onJoin: (nickname: string) => void }) {
  const [name, setName] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) onJoin(name.trim())
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-4">
      <h1 className="font-pixel text-[64px] leading-none">{APP_NAME}</h1>
      <div className="mt-6 flex items-end justify-between bg-accent px-3 py-4">
        <Horse id="h3" scale={2} running />
        <Horse id="h4" scale={2} running />
        <Horse id="h1" scale={2} running />
      </div>
      <p className="mt-6 text-[17px] leading-relaxed">
        AI models race through an escape room. You bet on them with Oats. Oats are free and are not real money.
      </p>
      <form onSubmit={submit} className="mt-8">
        <label htmlFor="name" className="text-[14px] text-muted">
          Your name
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={20}
          autoComplete="nickname"
          className="mt-2 h-14 w-full border-2 border-line bg-panel px-4 text-[18px] outline-none focus:border-text"
        />
        <button disabled={!name.trim()} className={`${PRIMARY} mt-4`}>
          Get 1,000 Oats
        </button>
      </form>
    </main>
  )
}

function BetSlip({
  horse, market, price, credits, onBet, onClose,
}: {
  horse: HorseRow; market: Market; price: number; credits: number; onBet: (amount: number) => void; onClose: () => void
}) {
  const [amount, setAmount] = useState(Math.min(100, credits))
  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="grow bg-bg/80" />
      <div role="dialog" aria-label="Bet slip" className="border-t-4 border-text bg-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-4">
            <div className="bg-accent p-1">
              <Horse id={horse.id} scale={2} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-pixel text-[34px] leading-none">{horse.name}</p>
              <p className="mt-1 text-[15px] text-muted">
                {market === 'win' ? 'To win' : 'To place'}, {odds(price)}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {[50, 100, 250, credits].map((option, i) => (
              <button
                key={i}
                disabled={option > credits || option < 1}
                aria-pressed={amount === option}
                onClick={() => setAmount(option)}
                className={`${BUTTON} ${amount === option ? 'border-accent bg-accent text-on-accent' : ''}`}
              >
                {i === 3 ? 'All in' : option}
              </button>
            ))}
          </div>
          <button disabled={amount < 1 || amount > credits} onClick={() => onBet(amount)} className={`${PRIMARY} mt-3`}>
            Bet {oats(amount)} Oats
          </button>
          <p className="mt-3 text-[14px] text-muted">
            Pays about {oats(amount * price)} Oats. The odds move until betting closes.
          </p>
        </div>
      </div>
    </div>
  )
}

// The phone view without its data source: the live page and the demo both render it.
export function PhoneView({
  view, player, bets, onJoin, onBet,
}: {
  view: RaceView
  player: Player | null
  bets: MyBet[]
  onJoin: (nickname: string) => void
  onBet: (horse: string, market: Market, amount: number) => void
}) {
  const { race, lanes } = view
  const [slip, setSlip] = useState<{ horse: string; market: Market } | null>(null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  if (!player) return <Join onJoin={onJoin} />

  const open = race.status !== 'settled' && !race.betting_closed_at
  const winner = lanes.find((lane) => lane.horse.id === race.winner_horse)
  const status =
    race.status === 'open'
      ? `Starts in ${clock(Date.parse(race.countdown_ends_at ?? race.opens_at) - now + 999)}`
      : race.status === 'running'
        ? `${clock(now - Date.parse(race.started_at!))} / ${clock(RACE_MS)}`
        : winner
          ? `${winner.horse.name} wins`
          : 'Race over'
  const slipLane = slip && lanes.find((lane) => lane.horse.id === slip.horse)

  return (
    <main className="mx-auto max-w-md pb-10">
      <header className="sticky top-0 z-[5] border-b-4 border-text bg-bg px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-pixel text-[34px] leading-none">{APP_NAME}</h1>
          <p className="font-pixel text-[34px] leading-none text-accent">{oats(player.credits)} Oats</p>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-4 text-[14px]">
          <p className="text-muted">
            Race {race.id}, {ROOMS[race.task] ?? race.task}
          </p>
          <p>{race.status === 'running' && !open ? `Bets closed, ${status}` : status}</p>
        </div>
      </header>

      <ol>
        {lanes.map((lane, i) => (
          <li key={lane.horse.id} className="border-b-2 border-line px-4 py-4">
            <div className="h-[62px]">
              <Track lane={lane} px={2} settled={race.status === 'settled'} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-pixel text-[28px] leading-none">
                  <span className="text-accent">{i + 1}</span> {lane.horse.name}
                </p>
                <p className="mt-1 truncate text-[13px] text-muted">{lane.horse.model}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {(['win', 'place'] as const).map((market) => (
                  <button
                    key={market}
                    disabled={!open}
                    onClick={() => setSlip({ horse: lane.horse.id, market })}
                    className="h-14 w-[78px] border-2 border-text leading-none disabled:border-line disabled:text-muted"
                  >
                    <span className="block text-[12px] text-muted">{market === 'win' ? 'Win' : 'Place'}</span>
                    <span className="mt-1 block font-pixel text-[26px] leading-none">{odds(lane[market])}</span>
                  </button>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="px-4 pt-6">
        <h2 className="font-pixel text-[28px] leading-none">Your bets</h2>
        {bets.length === 0 && <p className="mt-3 text-[15px] text-muted">No bets yet. Tap the odds of a horse to bet.</p>}
        <ul className="mt-3">
          {bets.map((bet, i) => (
            <li key={i} className="flex justify-between gap-4 border-b-2 border-line py-3 text-[15px]">
              <span className="truncate">
                {lanes.find((lane) => lane.horse.id === bet.horse)?.horse.name ?? bet.horse}, {bet.market === 'win' ? 'to win' : 'to place'}
              </span>
              <span className="shrink-0">{oats(bet.amount)} Oats</span>
            </li>
          ))}
        </ul>
        <Link to="/submit" className="mt-8 inline-block text-[15px] underline underline-offset-4">
          Enter your own model
        </Link>
      </section>

      {slip && slipLane && open && (
        <BetSlip
          horse={slipLane.horse}
          market={slip.market}
          price={slipLane[slip.market]}
          credits={player.credits}
          onClose={() => setSlip(null)}
          onBet={(amount) => {
            onBet(slip.horse, slip.market, amount)
            setSlip(null)
          }}
        />
      )}
    </main>
  )
}

function DemoPhone() {
  const view = useDemoRace()
  const [player, setPlayer] = useState<Player | null>(null)
  const [bets, setBets] = useState<MyBet[]>([])
  return (
    <PhoneView
      view={view}
      player={player}
      bets={bets}
      onJoin={(nickname) => setPlayer({ nickname, credits: 1000 })}
      onBet={(horse, market, amount) => {
        setPlayer((current) => current && { ...current, credits: current.credits - amount })
        setBets((current) => [{ horse, market, amount }, ...current])
      }}
    />
  )
}

export default function Phone() {
  // The fake race is only for design work. The live race data is not connected yet.
  if (new URLSearchParams(window.location.search).has('demo')) return <DemoPhone />
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <p className="font-pixel text-[40px] text-muted">No race yet</p>
    </main>
  )
}
