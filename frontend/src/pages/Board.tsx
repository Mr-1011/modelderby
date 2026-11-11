import { APP_NAME } from '@horserace/shared'
import { useEffect, useState } from 'react'
import Horse from '../components/Horse'
import { useDemoRace } from '../lib/demo'
import { clock, oats, odds } from '../lib/format'
import { type Lane, RACE_MS, type RaceView, ROOMS } from '../lib/race'
import { SPRITE_H, SPRITE_W } from '../lib/sprite'

// The board is drawn at 1920x1080 and scaled to the screen, so every size here is a real pixel on the big screen.
const W = 1920
const H = 1080
const LANES_H = 704
const COLUMNS = 'grid grid-cols-[56px_380px_1fr_132px_132px] gap-x-5'
const PLACES = ['1st', '2nd', '3rd']

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

// The left edge of a horse with n open locks. The nose of a horse with 5 locks is on the finish line.
const at = (n: number, spriteW: number) => `calc((100% - ${spriteW + 8}px) * ${n} / 5)`

function Track({ lane, px, settled }: { lane: Lane; px: number; settled: boolean }) {
  const { horse, entry } = lane
  const spriteW = SPRITE_W * px
  const locks = entry.locks_open
  const note =
    entry.state === 'escaped'
      ? `${PLACES[(entry.finish_pos ?? 0) - 1] ?? 'Escaped'} in ${clock(entry.solved_ms ?? 0)}`
      : settled
        ? `${locks} of 5 locks`
        : entry.state === 'running' && entry.last_step
          ? `$ ${entry.last_step}`
          : ''
  // The note goes on the side of the horse that has more room.
  const ahead = locks < 3
  return (
    <div className="relative h-full overflow-hidden bg-accent">
      {[1, 2, 3, 4].map((n) => (
        <i key={n} className="absolute inset-y-0 w-1 bg-accent-deep" style={{ left: `calc(${at(n, spriteW)} + ${spriteW}px)` }} />
      ))}
      <i className="finish absolute inset-y-0 right-0 w-8" />
      <p
        className={`absolute top-1/2 -translate-y-1/2 truncate text-[18px] font-medium text-on-accent ${ahead ? '' : 'text-right'}`}
        style={
          ahead
            ? { left: `calc(${at(locks, spriteW)} + ${spriteW + 16}px)`, right: 48 }
            : { left: 12, right: `calc(100% - ${at(locks, spriteW)} + 12px)` }
        }
      >
        {note}
      </p>
      <div
        className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-500 [transition-timing-function:steps(6)]"
        style={{ left: at(locks, spriteW) }}
      >
        {/* The key restarts the hop each time a lock opens. */}
        <div key={locks} className={locks ? 'motion-safe:animate-hop' : ''}>
          <Horse id={horse.id} scale={px} running={entry.state === 'running'} />
        </div>
      </div>
    </div>
  )
}

function BoardView({ race, lanes, challenges, pool }: RaceView) {
  const scale = useFit()
  const now = useNow()

  const laneH = Math.floor((LANES_H - (lanes.length - 1) * 4) / lanes.length)
  const px = Math.max(2, Math.floor(laneH / SPRITE_H))
  const spriteW = SPRITE_W * px
  const winner = lanes.find((lane) => lane.horse.id === race.winner_horse)

  const status =
    race.status === 'open'
      ? `Starts in ${clock(Date.parse(race.countdown_ends_at ?? race.opens_at) - now + 999)}`
      : race.status === 'running'
        ? `${clock(now - Date.parse(race.started_at!))} / ${clock(RACE_MS)}`
        : winner
          ? `${winner.horse.name} wins`
          : 'Race over'

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
          <span />
          <span />
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
          <ol className="flex flex-col gap-1">
            {lanes.map((lane, i) => (
              <li key={lane.horse.id} className={`${COLUMNS} items-center`} style={{ height: laneH }}>
                <span className="font-pixel text-[60px] leading-none text-accent">{i + 1}</span>
                <div className="min-w-0">
                  <p className="truncate font-pixel text-[42px] leading-none">{lane.horse.name}</p>
                  <p className="mt-1.5 truncate text-[17px] text-muted">{lane.horse.model}</p>
                </div>
                <Track lane={lane} px={px} settled={race.status === 'settled'} />
                <span className="text-right font-pixel text-[50px] leading-none">{odds(lane.win)}</span>
                <span className="text-right font-pixel text-[50px] leading-none text-muted">{odds(lane.place)}</span>
              </li>
            ))}
          </ol>

          {race.status === 'open' && (
            <div className="absolute right-[364px] top-1/2 w-[470px] -translate-y-1/2 border-4 border-text bg-bg p-8">
              <p className="font-pixel text-[76px] leading-none text-accent">Bet now</p>
              <p className="mt-4 text-[26px] font-medium">{window.location.host}</p>
              <p className="mt-2 text-[20px] text-muted">Pick a name and get 1,000 Oats.</p>
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

export default function Board() {
  // The fake race is only for design work. The live race data is not connected yet.
  if (new URLSearchParams(window.location.search).has('demo')) return <DemoBoard />
  return (
    <main className="fixed inset-0 grid place-items-center bg-bg">
      <p className="font-pixel text-[48px] text-muted">No race yet</p>
    </main>
  )
}
