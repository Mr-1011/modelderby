import { APP_NAME } from '@horserace/shared'
import { useEffect, useRef, useState } from 'react'
import Track, { at, Rail } from '../components/Track'
import { useDemoRace } from '../lib/demo'
import { oats, odds, usd } from '../lib/format'
import { useBoardRaceId, useRace } from '../lib/queries'
import { type RaceView, ROOMS, statusOf } from '../lib/race'
import { colorOf, SPRITE_H, SPRITE_W } from '../lib/sprite'

// The board is drawn at 1920x1080 and scaled to the screen, so every size here is a real pixel on the big screen.
const W = 1920
const H = 1080
const LANES_H = 704
const RAIL_H = 28
const COLUMNS = 'grid grid-cols-[56px_380px_1fr_132px_132px] gap-x-5'

function useFit() {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return scale
}

function useNow() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])
  return now
}

// One line of race commentary: the latest lock that a horse opened.
function useCommentary(lanes: RaceView['lanes']) {
  const [line, setLine] = useState('')
  const seen = useRef<Record<string, number>>({})
  useEffect(() => {
    for (const { horse, entry } of lanes) {
      const n = entry.locks_open
      if (n > (seen.current[horse.id] ?? 0))
        setLine(n === 5 ? `${horse.name} escapes the room` : `${horse.name} has ${n} ${n === 1 ? 'lock' : 'locks'} open`)
      seen.current[horse.id] = n
    }
  }, [lanes])
  return line
}

function BoardView({ race, lanes, challenges, pool }: RaceView) {
  const scale = useFit()
  const event = useCommentary(lanes)
  const commentary = race.status === 'open' ? 'Place your bets' : race.status === 'running' ? event || 'They are off' : event
  const now = useNow()

  const laneH = Math.floor((LANES_H - 2 * RAIL_H) / lanes.length)
  // One sprite pixel more than fits in a lane, so each horse overlaps the lane above it.
  const px = Math.floor(laneH / SPRITE_H) + 1
  const spriteW = SPRITE_W * px
  const winner = lanes.find((lane) => lane.horse.id === race.winner_horse)

  const status = statusOf(race, now, winner?.horse.name)

  return (
    <main className="fixed inset-0 overflow-hidden bg-bg">
      <div
        className="absolute left-1/2 top-1/2 flex flex-col p-10"
        style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <header className="flex h-[104px] items-end justify-between border-b-4 border-text pb-5">
          <div className="flex items-baseline gap-10">
            <h1 className="font-pixel text-[76px] leading-none">{APP_NAME}</h1>
            <p className="font-pixel text-[40px] leading-none text-muted">
              Race {race.id}, {ROOMS[race.task] ?? race.task}
            </p>
          </div>
          <div className="flex items-baseline gap-14">
            <p className="font-pixel text-[40px] leading-none text-muted">
              Pool <span className="text-text">{oats(pool)} Oats</span>
            </p>
            <p className="font-pixel text-[76px] leading-none text-accent">{status}</p>
          </div>
        </header>

        <div className={`${COLUMNS} mt-4 h-9 items-end font-pixel text-[28px] leading-none text-muted`}>
          {/* The commentary types itself in. The key restarts the typing for each new line. */}
          <p key={commentary} className="col-span-2 flex items-end text-accent">
            <span className="overflow-hidden whitespace-nowrap motion-safe:animate-type">{commentary}</span>
            <i className="mb-1 ml-1.5 h-5 w-3 shrink-0 bg-accent motion-safe:animate-blink" />
          </p>
          <div className="relative h-full">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className="absolute bottom-0 w-8 text-center"
                style={n === 5 ? { right: 0 } : { left: `calc(${at(n, spriteW)} + ${spriteW - 14}px)` }}
              >
                {n}
              </span>
            ))}
          </div>
          <span className="text-right">Win</span>
          <span className="text-right">Place</span>
        </div>

        <div className="relative mt-2">
          <div className={COLUMNS} style={{ height: RAIL_H }}>
            <div className="col-start-3">
              <Rail px={px} />
            </div>
          </div>
          <ol>
            {lanes.map((lane, i) => (
              <li key={lane.horse.id} className={`${COLUMNS} items-center`} style={{ height: laneH }}>
                <span
                  className="grid size-14 place-items-center font-pixel text-[44px] leading-none"
                  style={{ background: colorOf(lane.horse.id).color, color: colorOf(lane.horse.id).ink }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-pixel text-[42px] leading-none">{lane.horse.name}</p>
                  <p className="mt-1.5 flex justify-between gap-4 text-[17px] text-muted">
                    <span className="truncate">{lane.horse.model}</span>
                    {lane.entry.cost_usd > 0 && <span>{usd(lane.entry.cost_usd)}</span>}
                  </p>
                </div>
                <Track lane={lane} px={px} settled={race.status === 'settled'} notes stripe={i} />
                <span className="text-right font-pixel text-[50px] leading-none">{odds(lane.win)}</span>
                <span className="text-right font-pixel text-[50px] leading-none text-muted">{odds(lane.place)}</span>
              </li>
            ))}
          </ol>
          <div className={COLUMNS} style={{ height: RAIL_H }}>
            <div className="col-start-3">
              <Rail px={px} />
            </div>
          </div>

          {/* The start of a race: a large "Go" over the track for about one second. */}
          {race.status === 'running' && now - Date.parse(race.started_at!) < 1300 && (
            <p className="pointer-events-none absolute inset-y-0 left-[456px] right-[304px] grid place-items-center font-pixel text-[420px] leading-none text-text motion-safe:animate-go">
              Go
            </p>
          )}

          {race.status === 'open' && (
            <div className="absolute right-[364px] top-1/2 w-[470px] -translate-y-1/2 border-4 border-text bg-bg p-8">
              <p className="font-pixel text-[76px] leading-none text-accent motion-safe:animate-blink">Bet now</p>
              <p className="mt-4 text-[26px] font-medium">{window.location.host}</p>
              <p className="mt-2 text-[20px] text-muted">Sign in with Google and get 1,000 Oats.</p>
            </div>
          )}
        </div>

        <footer className="mt-auto grid h-[112px] grid-cols-6 gap-5 border-t-4 border-text pt-4">
          {challenges.map((challenge) => (
            <div key={challenge.id}>
              <p className="font-pixel text-[30px] leading-none">
                Lock {challenge.lock} <span className="text-muted">{challenge.category}</span>
              </p>
              <p className="mt-2 text-[15px] leading-snug text-muted">{challenge.public_blurb}</p>
            </div>
          ))}
          <div>
            <p className="font-pixel text-[30px] leading-none text-muted">Robotics</p>
            <p className="mt-2 text-[15px] leading-snug text-muted">Coming soon.</p>
          </div>
        </footer>
      </div>
    </main>
  )
}

function DemoBoard() {
  return <BoardView {...useDemoRace()} />
}

function LiveBoard() {
  const { data: view } = useRace(useBoardRaceId())
  if (view) return <BoardView race={view.race} lanes={view.lanes} challenges={view.challenges} pool={view.pool} />
  return (
    <main className="fixed inset-0 grid place-items-center bg-bg">
      <p className="font-pixel text-[48px] text-muted">No race yet</p>
    </main>
  )
}

export default function Board() {
  // The fake race is only for design work.
  return new URLSearchParams(window.location.search).has('demo') ? <DemoBoard /> : <LiveBoard />
}
