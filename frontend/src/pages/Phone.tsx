import { APP_NAME, type Horse as HorseRow, placeOdds, type Stakes, winPayout } from '@horserace/shared'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import GoogleButton from '../components/GoogleButton'
import Horse from '../components/Horse'
import Track, { grass, Rail } from '../components/Track'
import { useDemoRace } from '../lib/demo'
import { oats, odds, usd } from '../lib/format'
import { useModels } from '../lib/queries'
import { type RaceView, ROOMS, statusOf } from '../lib/race'
import { colorOf } from '../lib/sprite'

type Market = 'win' | 'place'
export type Player = { nickname: string; credits: number }
// payout is set when the race is settled. 0 is a lost bet.
export type MyBet = { horse: string; market: Market; amount: number; payout?: number | null }

const BUTTON = 'h-14 border-2 border-text font-pixel text-[28px] leading-none disabled:border-line disabled:text-muted'
const PRIMARY = 'h-14 w-full bg-accent font-pixel text-[30px] leading-none text-on-accent disabled:bg-line disabled:text-muted'

// Login is Google only, and only the button of Google starts it reliably. The demo has a button of its own.
function Join({ onJoin, demo }: { onJoin: (nickname: string) => void; demo: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-4">
      <h1 className="font-pixel text-[64px] leading-none">{APP_NAME}</h1>
      <div className="mt-6 flex items-end justify-between border-y-4 border-text px-3 pb-1 pt-4" style={grass(2)}>
        <Horse id="h3" scale={2} running />
        <Horse id="h4" scale={2} running />
        <Horse id="h1" scale={2} running />
      </div>
      <p className="mt-6 text-[17px] leading-relaxed">
        AI models race through an escape room. You bet on them with Oats. Oats are free and are not real money.
      </p>
      <div className="mt-8">
        {demo ? (
          <button onClick={() => onJoin('')} className={PRIMARY}>
            Sign in with Google
          </button>
        ) : (
          <GoogleButton long />
        )}
      </div>
      <p className="mt-3 text-[14px] text-muted">You start with 1,000 Oats.</p>
      <Link to="/" className="mt-8 text-[15px] underline underline-offset-4">
        All races
      </Link>
    </main>
  )
}

// pays gives what a stake pays. It is less than stake x odds, because the stake moves the odds of its own pool.
function BetSlip({
  horse, market, price, pays, credits, onBet, onClose,
}: {
  horse: HorseRow; market: Market; price: number; pays: (amount: number) => number
  credits: number; onBet: (amount: number) => void; onClose: () => void
}) {
  const [amount, setAmount] = useState(Math.min(100, credits))
  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="grow bg-bg/80" />
      <div
        role="dialog"
        aria-label="Bet slip"
        className="border-t-4 border-accent bg-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] motion-safe:animate-rise"
      >
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-4">
            <div className="p-1" style={grass(2)}>
              <Horse id={horse.id} scale={2} idle />
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
            Pays about {oats(pays(amount))} Oats. The odds move until betting closes.
          </p>
        </div>
      </div>
    </div>
  )
}

// The race page without its data source: the live page and the demo both render it.
// stakes are the Oats on each horse in both markets. Without them (the demo), the bet slip estimates the payout from the odds.
export function PhoneView({
  view, player, bets, onJoin, onBet, demo = false, stakes,
}: {
  view: RaceView
  stakes?: { win: Stakes; place: Stakes }
  player: Player | null
  bets: MyBet[]
  onJoin: (nickname: string) => void
  onBet: (horse: string, market: Market, amount: number) => void
  demo?: boolean
}) {
  const { race, lanes } = view
  const { data: models } = useModels()
  const [slip, setSlip] = useState<{ horse: string; market: Market } | null>(null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  if (!player) return <Join onJoin={onJoin} demo={demo} />

  const open = race.status !== 'settled' && !race.betting_closed_at
  const winner = lanes.find((lane) => lane.horse.id === race.winner_horse)
  const status = statusOf(race, now, winner?.horse.name)
  const slipLane = slip && lanes.find((lane) => lane.horse.id === slip.horse)
  // A player bets on one horse per race.
  const mine = bets[0]?.horse
  // The size of one sprite pixel. A lane is 18 sprite pixels high and a horse is 27, so the horses overlap.
  const px = window.innerWidth < 1024 ? 2 : 3

  return (
    <main className="pb-10">
      <header className="sticky top-0 z-[5] border-b-4 border-text bg-bg pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-baseline justify-between gap-4">
            {/* The way back to the race list. */}
            <Link to="/" className="font-pixel text-[34px] leading-none">
              {APP_NAME}
            </Link>
            <p className="font-pixel text-[34px] leading-none text-accent">{oats(player.credits)} Oats</p>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-4 text-[14px]">
            <p className="text-muted">
              Race {race.id}, {ROOMS[race.task] ?? race.task}
            </p>
            <p>{race.status === 'running' && !open ? `Bets closed, ${status}` : status}</p>
          </div>
        </div>
      </header>

      {/* The track shows only when the race has started. Before the start, the horses wait in their boxes. */}
      {race.status !== 'open' && (
        <div className="border-b-4 border-text">
          <div style={{ height: px * 10 }}>
            <Rail px={px} />
          </div>
          {lanes.map((lane, i) => (
            <div key={lane.horse.id} style={{ height: px * 18 }}>
              <Track lane={lane} px={px} settled={race.status === 'settled'} stripe={i} />
            </div>
          ))}
          <div style={{ height: px * 6 }}>
            <Rail px={px} />
          </div>
        </div>
      )}

      <ol className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 pt-4 sm:grid-cols-3 lg:grid-cols-4">
        {lanes.map(({ horse, entry, ...price }, i) => {
          const model = models?.find((option) => option.id === horse.model)
          return (
            <li key={horse.id} className={`min-w-0 border-2 bg-panel ${mine === horse.id ? 'border-accent' : 'border-line'}`}>
              <div className="relative flex justify-center pb-1 pt-5" style={grass(px)}>
                <span
                  className="absolute left-0 top-0 grid size-7 place-items-center font-pixel text-[22px] leading-none"
                  style={{ background: colorOf(horse.id).color, color: colorOf(horse.id).ink }}
                >
                  {i + 1}
                </span>
                <Horse id={horse.id} scale={px} idle running={entry.state === 'running'} />
              </div>
              <div className="p-3">
                <p className="truncate font-pixel text-[26px] leading-none">{horse.name}</p>
                <p className="mt-1.5 truncate text-[12px] text-muted">{horse.model}</p>
                <p className="truncate text-[12px] text-muted">
                  {horse.provider}
                  {horse.reasoning_effort && `, ${horse.reasoning_effort} effort`}
                </p>
                <p className="truncate text-[12px] text-muted">
                  {entry.steps > 0
                    ? `${entry.locks_open} of 5 locks, ${usd(entry.cost_usd)}`
                    : model
                      ? `${usd(model.prompt)} / ${usd(model.completion)} per M`
                      : ' '}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(['win', 'place'] as const).map((market) => (
                    <button
                      key={market}
                      disabled={!open || (mine !== undefined && mine !== horse.id)}
                      onClick={() => setSlip({ horse: horse.id, market })}
                      className="h-16 border-2 border-text leading-none disabled:border-line disabled:text-muted"
                    >
                      <span className="block text-[12px] text-muted">{market === 'win' ? 'Win' : 'Place'}</span>
                      <span className="mt-1 block font-pixel text-[30px] leading-none">{odds(price[market])}</span>
                    </button>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <section className="mx-auto max-w-6xl px-4 pt-8">
        <h2 className="font-pixel text-[28px] leading-none">Your bets</h2>
        {bets.length === 0 && (
          <p className="mt-3 text-[15px] text-muted">No bets yet. Pick one horse and tap its odds. You bet on one horse per race.</p>
        )}
        <ul className="mt-3 max-w-md">
          {bets.map((bet, i) => (
            <li key={i} className="flex justify-between gap-4 border-b-2 border-line py-3 text-[15px]">
              <span className="truncate">
                {lanes.find((lane) => lane.horse.id === bet.horse)?.horse.name ?? bet.horse}, {bet.market === 'win' ? 'to win' : 'to place'}
              </span>
              {bet.payout == null ? (
                <span className="shrink-0">{oats(bet.amount)} Oats</span>
              ) : bet.payout > 0 ? (
                <span className="shrink-0 text-accent">Won {oats(bet.payout)} Oats</span>
              ) : (
                <span className="shrink-0 text-muted">Lost {oats(bet.amount)} Oats</span>
              )}
            </li>
          ))}
        </ul>
        <Link to="/arena" className="mt-8 inline-block text-[15px] underline underline-offset-4">
          Enter your own model
        </Link>
      </section>

      {slip && slipLane && open && (
        <BetSlip
          horse={slipLane.horse}
          market={slip.market}
          price={slipLane[slip.market]}
          pays={(amount) => {
            const id = slip.horse
            if (!stakes) return amount * slipLane[slip.market]
            // Exact for Win if no bet comes after it. For Place it is an estimate, because the other placed horses are not known.
            if (slip.market === 'win') return winPayout({ ...stakes.win, [id]: stakes.win[id] ?? 0 }, id, amount)
            const place = { ...stakes.place, [id]: (stakes.place[id] ?? 0) + amount }
            return amount * placeOdds(place, id, lanes.length, race.place_count)
          }}
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
      demo
      player={player}
      bets={bets}
      onJoin={() => setPlayer({ nickname: 'You', credits: 1000 })}
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
