import { finishOrder, type Horse as HorseRow, placeOdds, type Stakes, winPayout } from '@horserace/shared'
import { type ReactNode, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Glyph from '../components/Glyph'
import Horse from '../components/Horse'
import RoomView from '../components/RoomView'
import Track, { grass, Rail } from '../components/Track'
import { useDemoRace } from '../lib/demo'
import { oats, odds, usd } from '../lib/format'
import { useModels } from '../lib/queries'
import { BLURBS, progressOf, type RaceView, ROOMS, stateOf, statusOf } from '../lib/race'
import { colorOf } from '../lib/sprite'

type Market = 'win' | 'place'
export type Player = { nickname: string; credits: number }
// payout is set when the race is settled. 0 is a lost bet.
export type MyBet = { horse: string; market: Market; amount: number; payout?: number | null }

const BUTTON =
  'h-14 border-2 border-text font-pixel text-[30px] leading-none hover:border-accent hover:text-accent disabled:border-line disabled:text-muted aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent'
const PRIMARY = 'h-14 w-full bg-accent font-pixel text-[30px] leading-none text-on-accent hover:bg-accent-deep disabled:bg-line disabled:text-muted'

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
              <p className="truncate font-pixel text-[30px] leading-none">{horse.name}</p>
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
                className={BUTTON}
              >
                {i === 3 ? 'All in' : option}
              </button>
            ))}
          </div>
          <button disabled={amount < 1 || amount > credits} onClick={() => onBet(amount)} className={`${PRIMARY} mt-3`}>
            Bet {oats(amount)} Credits
          </button>
          <p className="mt-3 text-[14px] text-muted">
            Pays about {oats(pays(amount))} Credits. The odds move until betting closes.
          </p>
        </div>
      </div>
    </div>
  )
}

// The race page without its data source: the live page and the demo both render it. It goes below the header of the Shell.
// The page is open without an account: player is null then, and a tap on the odds leads to the sign-in page.
// stakes are the Credits on each horse in both markets. Without them (the demo), the bet slip estimates the payout from the odds.
// chart draws the odds chart. It gets the horse that the page highlights, and a function to set it.
// add is one more box after the horses: the free place where a player adds a horse.
export function PhoneView({
  view, player, bets, onBet, stakes, chart, add,
}: {
  view: RaceView
  add?: ReactNode
  chart?: (active: string | null, onActive: (horse: string | null) => void) => ReactNode
  stakes?: { win: Stakes; place: Stakes }
  player: Player | null
  bets: MyBet[]
  onBet: (horse: string, market: Market, amount: number) => void
}) {
  const { race, lanes } = view
  const { data: models } = useModels()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [slip, setSlip] = useState<{ horse: string; market: Market } | null>(null)
  // The horse under the pointer, in the chart or in the boxes.
  const [active, setActive] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  const open = race.status !== 'settled' && !race.betting_closed_at
  const winner = lanes.find((lane) => lane.horse.id === race.winner_horse)
  const status = statusOf(race, now, winner?.horse.name)
  // The cheapest horse that has finished. A horse that still runs must stay below its cost to win.
  const best = lanes.find((lane) => lane.horse.id === finishOrder(lanes.map((each) => each.entry))[0] && lane.entry.state === 'escaped')
  const slipLane = slip && lanes.find((lane) => lane.horse.id === slip.horse)
  // A player bets on one horse per race.
  const mine = bets[0]?.horse
  // The size of one sprite pixel. A lane is 18 sprite pixels high and a horse is 27, so the horses overlap.
  const px = window.innerWidth < 1024 ? 2 : 3

  return (
    <main>
      {/* On a wide screen the status is on the line of the title. On a phone it has its own row. */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-4 py-6 lg:grid-cols-[auto_1fr_auto] lg:items-baseline">
        <div className="lg:self-center">
          <Glyph name={race.task} px={px} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-pixel text-[30px] leading-none lg:text-[45px]">{ROOMS[race.task] ?? race.task}</h1>
          <p className="mt-2 max-w-[52ch] text-balance text-[13px] leading-5 text-muted lg:text-[15px]">{BLURBS[race.task]}</p>
        </div>
        <div className="col-span-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 font-pixel text-[30px] leading-none lg:col-span-1 lg:flex-col lg:items-end">
          <p className="text-accent">{winner ? `${status}, ${usd(winner.entry.cost_usd)}` : status}</p>
          <p className="text-muted">
            {race.status === 'running' && best ? (
              <>Bets closed, <span className="text-text">{usd(best.entry.cost_usd)}</span> to beat</>
            ) : (
              view.pool > 0 && <>Pool <span className="text-text">{oats(view.pool)}</span></>
            )}
          </p>
        </div>
      </div>

      {chart?.(active, setActive)}

      {/* The track shows only when the race has started. Before the start, the horses wait in their boxes. */}
      {race.status !== 'open' && (
        <div className="-mx-4 mt-6 border-y-4 border-text lg:mx-0 lg:border-x-4">
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

      <ol className="grid grid-cols-2 gap-3 pt-6 sm:grid-cols-3 lg:grid-cols-4">
        {lanes.map(({ horse, entry, ...price }, i) => {
          const model = models?.find((option) => option.id === horse.model)
          return (
            <li
              key={horse.id}
              onPointerEnter={() => setActive(horse.id)}
              onPointerLeave={() => setActive(null)}
              className={`min-w-0 border-2 bg-panel ${active === horse.id ? 'border-text' : mine === horse.id ? 'border-accent' : 'border-line'}`}
            >
              <div className="relative flex justify-center pb-1 pt-5" style={grass(px)}>
                <span
                  className="absolute left-0 top-0 grid size-7 place-items-center font-pixel text-[30px] leading-none"
                  style={{ background: colorOf(horse.id).color, color: colorOf(horse.id).ink }}
                >
                  {i + 1}
                </span>
                <Horse id={horse.id} scale={px} idle running={entry.state === 'running'} />
              </div>
              <div className="p-3">
                <p className="truncate font-pixel text-[22.5px] leading-none lg:text-[30px]">{horse.name}</p>
                {/* The model id names the provider, so the provider has no line of its own. */}
                <p className="mt-1.5 truncate text-[12px] text-muted">
                  {horse.model}
                  {horse.reasoning_effort && `, ${horse.reasoning_effort} effort`}
                </p>
                {/* Before the race: the token price of the model. Then: how far the horse is, and what it has cost. */}
                {entry.state === 'waiting' ? (
                  <p className="truncate text-[12px] text-muted">{model ? `${usd(model.prompt)} / ${usd(model.completion)} per M` : '\u00a0'}</p>
                ) : (
                  <>
                    <p className={`truncate text-[12px] ${entry.state === 'escaped' ? 'text-accent' : 'text-muted'}`}>
                      {progressOf(race.task, entry)}, {stateOf(entry)}
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <p className="font-pixel text-[30px] leading-none">{usd(entry.cost_usd)}</p>
                      {entry.view && <RoomView view={entry.view} cell={px + 2} />}
                    </div>
                  </>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(['win', 'place'] as const).map((market) => {
                    // The stake of the player on this horse in this market is on the button, and after the race the result.
                    const own = bets.filter((bet) => bet.horse === horse.id && bet.market === market)
                    const staked = own.reduce((sum, bet) => sum + bet.amount, 0)
                    const paid = own.reduce((sum, bet) => sum + (bet.payout ?? 0), 0)
                    const name = market === 'win' ? 'Win' : 'Place'
                    // A short text for the narrow button of a phone, and a long text for a wide screen.
                    const [short, long] = !staked
                      ? [name, name]
                      : own[0].payout == null
                        ? [oats(staked), `${name} ${oats(staked)}`]
                        : paid > 0
                          ? [`+${oats(paid)}`, `Won ${oats(paid)}`]
                          : [`-${oats(staked)}`, `Lost ${oats(staked)}`]
                    return (
                      <button
                        key={market}
                        disabled={!open || (mine !== undefined && mine !== horse.id)}
                        onClick={() => (player ? setSlip({ horse: horse.id, market }) : navigate('/signin', { state: { from: pathname } }))}
                        className={`h-16 border-2 leading-none enabled:hover:border-accent enabled:hover:text-accent ${staked ? 'border-accent' : 'border-text disabled:border-line disabled:text-muted'}`}
                      >
                        <span className={`block truncate text-[12px] ${staked ? 'text-accent' : 'text-muted'}`}>
                          <span className="lg:hidden">{short}</span>
                          <span className="hidden lg:inline">{long}</span>
                        </span>
                        <span className="mt-1 block font-pixel text-[30px] leading-none">{odds(price[market])}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </li>
          )
        })}
        {add}
      </ol>

      {player && slip && slipLane && open && (
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
  const [player, setPlayer] = useState<Player>({ nickname: 'You', credits: 1000 })
  const [bets, setBets] = useState<MyBet[]>([])
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10">
      <PhoneView
        view={view}
        player={player}
        bets={bets}
        onBet={(horse, market, amount) => {
          setPlayer((current) => ({ ...current, credits: current.credits - amount }))
          setBets((current) => [{ horse, market, amount }, ...current])
        }}
      />
    </div>
  )
}

export default function Phone() {
  // The fake race is only for design work. The live race data is not connected yet.
  if (new URLSearchParams(window.location.search).has('demo')) return <DemoPhone />
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <p className="font-pixel text-[45px] text-muted">No race yet</p>
    </main>
  )
}
