import type { RaceEvent } from '@horserace/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { clock, usd } from '../lib/format'
import { type LiveRace, startRace, useForksToday, useIsAdmin, useNow, useRace, useRaceEvents, useRaces } from '../lib/queries'
import { type Lane, RACE_MS, ROOMS, statusOf } from '../lib/race'

// The ops view: what the runner really does in the 3 newest races. Disk, base room, one fork per horse,
// each model step and each tool call. Only an admin gets the events, and the route exists only on a local server.

const MAX_STEPS = 40
// The height of a fork node and the gap between two rows, in px. The trunk line ends at the branch of the last row.
const NODE_H = 192
const ROW_GAP = 8
const LABEL = 'font-pixel text-[15px] uppercase leading-none text-muted'

const time = (at: string) => new Date(at).toLocaleTimeString('en-GB')
const kilo = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

const stateText = (lane: Lane, racing: boolean) =>
  ({ waiting: racing ? 'forking' : 'waiting', running: 'running', escaped: 'solved', out: 'out', timeout: 'timeout', failed: 'failed' })[
    lane.entry.state
  ]

function Node({ lane, events, view, now, right }: { lane: Lane; events: RaceEvent[]; view: LiveRace; now: number; right: boolean }) {
  const { horse, entry } = lane
  const mine = events.filter((event) => event.horse_id === horse.id)
  const steps = mine.filter((event) => event.kind === 'step')
  const calls = mine.filter((event) => event.kind === 'tool_call').slice(0, 3).reverse()
  const flash = mine.find((event) => ['fork_created', 'checkpoint', 'solved', 'out'].includes(event.kind))
  const forked = !!entry.sandbox_id || mine.some((event) => event.kind === 'fork_created')
  const racing = view.race.status === 'running'
  const state = stateText(lane, racing)
  const elapsed = entry.solved_ms ?? (racing && view.race.started_at ? now - Date.parse(view.race.started_at) : 0)
  const tokensIn = steps.reduce((sum, event) => sum + (event.tokens_in ?? 0), 0)
  const tokensOut = steps.reduce((sum, event) => sum + (event.tokens_out ?? 0), 0)
  // The runner has no events for an old race. The last command of the entry is then the only tool call.
  const lines = calls.length ? calls.map((event) => event.text ?? '') : entry.last_step ? [entry.last_step] : []
  return (
    <li className="relative">
      {/* The line from the trunk to this fork. It turns orange when the fork exists. */}
      <div className={`absolute top-5 h-0.5 w-3 ${right ? '-left-3' : '-right-3'} ${forked ? 'bg-accent' : 'bg-line'}`} />
      <div className={`relative h-48 border-2 p-2 ${forked ? 'border-accent' : 'border-line'} ${entry.state === 'running' ? 'bg-panel' : ''}`}>
        {flash && <div key={flash.id} className="pointer-events-none absolute inset-0 animate-flash bg-accent" />}
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-pixel text-[30px] leading-none">{horse.name}</p>
          <p className={`shrink-0 font-pixel text-[15px] uppercase leading-none ${state === 'running' || state === 'solved' ? 'text-accent' : 'text-muted'}`}>
            {state}
          </p>
        </div>
        <p className="mt-1 truncate text-[11px] text-muted">
          {horse.model}
          {horse.reasoning_effort && ` / ${horse.reasoning_effort}`}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1" aria-label={`Progress ${entry.progress} of 100`}>
            {[20, 40, 60, 80, 100].map((mark) => (
              <div key={mark} className={`size-3 border-2 ${entry.progress >= mark ? 'border-accent bg-accent' : 'border-line'}`} />
            ))}
          </div>
          <p className="font-pixel text-[30px] leading-none">{usd(entry.cost_usd)}</p>
        </div>
        <p className="mt-1 truncate text-[11px] text-muted">
          step {entry.steps}/{MAX_STEPS}, {clock(elapsed)},{' '}
          {steps.length ? `${kilo(tokensIn)} in ${kilo(tokensOut)} out` : `${kilo(entry.tokens)} tokens`}
        </p>
        <p className="mt-1 h-4 truncate text-[12px]">{steps[0]?.text}</p>
        <div className="h-12 overflow-hidden text-[12px] leading-4">
          {lines.map((line, i) => (
            <p key={i} className={`truncate ${i === lines.length - 1 ? '' : 'text-muted'}`}>
              $ {line}
            </p>
          ))}
        </div>
      </div>
    </li>
  )
}

function Box({ label, value, lit }: { label: string; value: string; lit: boolean }) {
  return (
    <div className={`min-w-0 border-2 px-2 py-1 ${lit ? 'border-accent' : 'border-line'}`}>
      <p className={LABEL}>{label}</p>
      <p className="truncate text-[12px]">{value}</p>
    </div>
  )
}

// The start button of an open race.
function Start({ view, now, onError }: { view: LiveRace; now: number; onError: (text: string) => void }) {
  const { race } = view
  const client = useQueryClient()
  if (race.status !== 'open') return null
  return (
    <button
      // In the last 20 seconds the runner builds the room, so a start changes nothing.
      disabled={race.ready && Date.parse(race.countdown_ends_at ?? race.opens_at) - now < 20_000}
      onClick={(event) => {
        // The box of the race in the overview opens the detail view on a click, and this button must not.
        event.stopPropagation()
        startRace(race.id).then(
          () => client.invalidateQueries({ queryKey: ['races'] }),
          (failure: Error) => onError(failure.message),
        )
      }}
      className="h-9 shrink-0 bg-accent px-3 font-pixel text-[15px] uppercase leading-none text-on-accent disabled:bg-line disabled:text-muted"
    >
      Start now
    </button>
  )
}

// The files that the runner writes to the disk for each horse. The first one grows during the race.
const FILES = ['log.jsonl', 'final.diff', 'room.tar.gz', 'result.json']
const ENDS = ['solved', 'out', 'timeout', 'failed']
const ms = (event: RaceEvent) => Date.parse(event.at)
const seconds = (span: number) => `${(span / 1000).toFixed(1)} s`
// How an event shows on the time line of its machine.
const TICK: Partial<Record<RaceEvent['kind'], string>> = {
  fork_created: 'w-1 bg-accent',
  tool_call: 'w-0.5 bg-accent',
  checkpoint: 'w-1 bg-text',
  solved: 'w-2 bg-text',
  out: 'w-2 bg-muted',
  timeout: 'w-2 bg-muted',
  failed: 'w-2 bg-muted',
}

type Stage = 'todo' | 'now' | 'done'

// One step in the life of a machine: muted before it happens, its mark blinks while it happens, then it stays lit.
function Step({ name, value, stage }: { name: string; value: string; stage: Stage }) {
  return (
    <p className={`flex justify-between gap-2 text-[11px] leading-4 ${stage === 'todo' ? 'text-muted' : ''}`}>
      <span className={stage === 'todo' ? '' : 'text-accent'}>
        <span className={stage === 'now' ? 'animate-blink' : ''}>{stage === 'done' ? '+' : stage === 'now' ? '>' : '.'}</span> {name}
      </span>
      <span className="truncate">{value}</span>
    </p>
  )
}

// One machine of the detail view: the fork of one horse, from the events up to the playhead.
// order is its place in the order of the forks: the machines come up in that order.
// logged is false for an old race with no events. The entry then gives the end state.
function Machine({
  lane,
  seen,
  race,
  logged,
  settled,
  first,
  order,
  column,
  edge,
}: {
  lane: Lane
  seen: RaceEvent[]
  race: LiveRace['race']
  logged: boolean
  settled: boolean
  first: number
  order: number
  column: number
  edge: string
}) {
  const { horse, entry } = lane
  const mine = seen.filter((event) => event.horse_id === horse.id)
  const fork = mine.find((event) => event.kind === 'fork_created')
  const steps = mine.filter((event) => event.kind === 'step')
  const calls = mine.filter((event) => event.kind === 'tool_call')
  const last = mine.find((event) => ENDS.includes(event.kind))
  const flash = mine.find((event) => event.kind === 'checkpoint' || ENDS.includes(event.kind))
  const [sandbox, forkMs] = logged ? (fork?.text?.split(' ') ?? []) : [entry.sandbox_id ?? undefined]
  const count = logged ? steps.length : entry.steps
  const cost = logged ? steps.reduce((sum, event) => sum + Number(event.cost_usd ?? 0), 0) : Number(entry.cost_usd)
  const progress = logged ? Number(mine.find((event) => event.kind === 'checkpoint' || event.kind === 'solved')?.text ?? 0) : entry.progress
  const end = logged ? last?.kind : entry.state === 'escaped' ? 'solved' : ENDS.includes(entry.state) ? entry.state : undefined
  const state = !sandbox ? 'no machine' : settled ? 'removed' : (end ?? 'running')
  const stage = (done: boolean, now: boolean): Stage => (done ? 'done' : now ? 'now' : 'todo')
  const delay = { animationDelay: `${order * 150}ms` }
  return (
    <li className="min-w-0">
      {/* The piece of the trunk above this machine, then the branch. */}
      <div className={`h-0.5 ${edge} ${sandbox ? 'bg-accent' : 'bg-line'}`} />
      <div className={`mx-auto h-4 w-0.5 ${sandbox ? 'bg-accent' : 'bg-line'}`} />
      <div className="px-1">
        {sandbox ? (
          <div className="overflow-hidden">
            {/* A machine that is removed loses its orange outline: only its files on the disk stay. */}
            <div className={`relative h-84 animate-rise overflow-hidden border-2 p-2 ${settled ? 'border-line' : 'border-accent'} ${state === 'running' ? 'bg-panel' : ''}`} style={delay}>
              <div className="pointer-events-none absolute inset-0 animate-flash bg-accent" style={delay} />
              {flash && <div key={flash.id} className="pointer-events-none absolute inset-0 animate-flash bg-accent" />}
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-pixel text-[15px] uppercase leading-none text-accent">VM {column + 1}</p>
                <p className={`font-pixel text-[15px] uppercase leading-none ${state === 'running' || state === 'solved' ? 'text-accent' : 'text-muted'}`}>{state}</p>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted">{sandbox}</p>
              <p className="mt-2 truncate font-pixel text-[22.5px] leading-none">{horse.name}</p>
              <p className="mt-1 truncate text-[11px] text-muted">
                {horse.model}
                {horse.reasoning_effort && ` / ${horse.reasoning_effort}`}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1" aria-label={`Progress ${progress} of 100`}>
                  {[20, 40, 60, 80, 100].map((mark) => (
                    <div key={mark} className={`size-3 border-2 ${progress >= mark ? 'border-accent bg-accent' : 'border-line'}`} />
                  ))}
                </div>
                <p className="font-pixel text-[30px] leading-none">{usd(cost)}</p>
              </div>
              <div className="mt-2">
                <Step name="fork" value={forkMs ? `${forkMs} ms` : 'from the base'} stage="done" />
                <Step name="run" value={`step ${count}/${MAX_STEPS}${logged ? `, ${calls.length} commands` : ''}`} stage={stage(!!end, true)} />
                <Step name="check" value={`${progress} / 100`} stage={stage(!!end, count > 0)} />
                <Step name="end" value={end ? `${end}${last ? ` at T+${seconds(ms(last) - first)}` : ''}` : ''} stage={stage(!!end, false)} />
                <Step name="save" value={settled ? `${FILES.length} files` : count > 0 ? 'log.jsonl' : ''} stage={stage(settled, count > 0)} />
                <Step name="remove" value={settled ? 'machine deleted' : ''} stage={stage(settled, false)} />
              </div>
              <div className="mt-1 text-[11px] leading-4">
                {calls.slice(0, 5).reverse().map((event, i, list) => (
                  <p key={event.id} className={`truncate ${i === list.length - 1 ? 'animate-type' : 'text-muted'}`}>
                    $ {event.text}
                  </p>
                ))}
                {!logged && entry.last_step && <p className="truncate">$ {entry.last_step}</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid h-84 place-items-center border-2 border-dashed border-line p-2">
            <p className="text-center font-pixel text-[22.5px] leading-none text-muted">{horse.name}</p>
          </div>
        )}
        {/* What the runner keeps of this machine on the disk. */}
        <div className={`mx-auto h-3 w-0.5 ${count > 0 ? 'bg-accent' : 'bg-line'}`} />
        <div className={`border-2 p-2 text-[11px] leading-4 ${count > 0 ? 'border-accent' : 'border-line'}`}>
          <p className="truncate text-muted">
            derby/races/{race.id}/{horse.id}/
          </p>
          {FILES.map((file, i) => (
            <p key={file} className={(i === 0 ? count > 0 : settled) ? '' : 'text-muted'}>
              {file}
            </p>
          ))}
        </div>
      </div>
    </li>
  )
}

// One race in detail, built from its events in the order in which they came: the disk, the base sandbox that is built once,
// one machine per horse that forks from it, each command, each check, then the files on the disk and the end of the machines.
// A finished race plays again from its first event. A race that runs shows each event when it comes.
function Detail({ id, events, now, onError }: { id: number; events: RaceEvent[]; now: number; onError: (text: string) => void }) {
  const { data: view } = useRace(id)
  // The playhead of a replay, as a time in ms. Without it the view is live.
  const [head, setHead] = useState<number>()
  const auto = useRef(false)
  const mine = events.filter((event) => event.race_id === id)
  const first = mine.length ? ms(mine.at(-1)!) : 0
  const final = mine.length ? ms(mine[0]) : 0
  const replay = head !== undefined
  const status = view?.race.status
  // A finished race plays one time when the view opens. A race that ends in front of the user does not play again.
  useEffect(() => {
    if (auto.current || !status || !first) return
    auto.current = true
    if (status === 'settled') setHead(first - 500)
  }, [status, first])
  // The full race plays in about 20 seconds.
  useEffect(() => {
    if (!replay) return
    const timer = setInterval(() => setHead((time) => (time === undefined || time > final ? undefined : time + Math.max(50, (final - first) / 220))), 90)
    return () => clearInterval(timer)
  }, [replay, first, final])

  if (!view) return <p className="text-muted">Loading</p>
  const { race, lanes } = view
  const logged = mine.length > 0
  const seen = replay ? mine.filter((event) => ms(event) <= head) : mine
  const [, baseId, baseMs] = seen.find((event) => event.kind === 'base_built')?.text?.split(' ') ?? []
  // Oldest first: the order in which the machines came up.
  const forks = seen.filter((event) => event.kind === 'fork_created').reverse()
  const ended = seen.filter((event) => ENDS.includes(event.kind))
  const result = seen.find((event) => event.kind === 'settled')
  const built = logged ? !!baseId : race.status !== 'open'
  const forked = logged ? forks.length : lanes.filter((lane) => lane.entry.sandbox_id).length
  const over = (logged ? ended.length : lanes.filter((lane) => !['waiting', 'running'].includes(lane.entry.state)).length) >= lanes.length && forked > 0
  const settled = logged ? !!result : race.status === 'settled'
  const solved = logged ? ended.filter((event) => event.kind === 'solved').length : lanes.filter((lane) => lane.entry.state === 'escaped').length
  const name = (horse: string | null | undefined) => lanes.find((lane) => lane.horse.id === horse)?.horse.name
  const winner = name(race.winner_horse)
  const count = (kind: RaceEvent['kind']) => seen.filter((event) => event.kind === kind).length
  const phases: [string, string, boolean][] = [
    ['Disk', `derby/rooms/${race.task}/`, true],
    ['Base sandbox', baseId ? `built in ${baseMs} ms` : built ? 'built' : 'not built', built],
    ['Fork', `${forked} of ${lanes.length} machines${forks.length > 1 ? `, all in ${ms(forks.at(-1)!) - ms(forks[0])} ms` : ''}`, forked >= lanes.length],
    ['Run', logged ? `${count('step')} steps, ${count('tool_call')} commands` : `${lanes.reduce((sum, lane) => sum + lane.entry.steps, 0)} steps`, over],
    ['Check', `${solved} of ${lanes.length} solved`, over],
    ['Save', settled ? `${lanes.length * FILES.length} files on the disk` : forked ? 'the logs grow' : '', settled],
    ['Settle', settled && winner ? `winner ${winner}` : '', settled],
  ]
  const current = race.status === 'open' && !built ? -1 : phases.findIndex(([, , done]) => !done)
  // The checks and the logs go on while the machines run.
  const live = (i: number) => i === current || (current === 3 && (i === 4 || i === 5))
  // The time line goes from the first event to the last one. For a race that runs, it goes to the time limit.
  const to = settled || replay ? final : Math.max(now, (forks[0] ? ms(forks[0]) : first) + RACE_MS)
  const x = (time: number) => Math.min(100, Math.max(0, ((time - first) / (to - first)) * 100))
  const clockNow = replay ? head : race.status === 'running' ? now : final
  const newest = seen[0]
  return (
    <section className="min-w-0 border-2 border-accent p-3">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
        <div className="min-w-0">
          <Link to="/ops" className="font-pixel text-[15px] uppercase leading-none text-accent">
            &lt; Overview
          </Link>
          <p className="mt-2 truncate font-pixel text-[30px] leading-none">
            Race {race.id} <span className="text-muted">{ROOMS[race.task] ?? race.task}</span>
          </p>
          <p className="mt-1 text-[12px] text-muted">{statusOf(race, now, winner)}</p>
        </div>
        <div>
          <p className={LABEL}>{replay ? 'Replay' : race.status === 'running' ? 'Live' : 'Time'}</p>
          <p className="mt-1 font-pixel text-[30px] leading-none">{logged ? `T+${seconds(Math.max(0, clockNow - first))}` : '-'}</p>
        </div>
        {/* The event that came last, so each change has a name. */}
        <div className="min-w-0 flex-1">
          <p className={LABEL}>Now</p>
          <p className="mt-1 truncate font-pixel text-[30px] leading-none">
            {newest ? (
              <>
                <span className="text-accent">{newest.kind.replace('_', ' ')}</span> {name(newest.horse_id)}{' '}
                <span className="text-muted">{newest.kind === 'tool_call' ? `$ ${newest.text}` : newest.kind === 'settled' ? name(newest.text) : newest.text}</span>
              </>
            ) : (
              <span className="text-muted">{logged ? 'start' : race.status === 'open' ? 'waits for the start' : 'no events for this race'}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {logged && (
            <button onClick={() => setHead(replay ? undefined : first - 500)} className="h-9 border-2 border-text px-3 font-pixel text-[15px] uppercase leading-none">
              {replay ? 'Skip' : 'Replay'}
            </button>
          )}
          <Start view={view} now={now} onError={onError} />
        </div>
      </div>

      {/* The steps of the race from left to right. A step is muted before it happens, and it flashes when it is done. */}
      <ol className="mt-3 flex items-stretch">
        {phases.map(([label, value, done], i) => (
          <li key={label} className="flex min-w-0 flex-1 items-center">
            {i > 0 && <div className={`h-0.5 w-3 shrink-0 ${done || live(i) ? 'bg-accent' : 'bg-line'}`} />}
            <div className={`relative h-full min-w-0 flex-1 border-2 px-2 py-1 ${done || live(i) ? 'border-accent' : 'border-line'} ${live(i) ? 'bg-panel' : ''}`}>
              {done && <div className="pointer-events-none absolute inset-0 animate-flash bg-accent" />}
              <p className={`font-pixel text-[15px] uppercase leading-none ${done || live(i) ? 'text-accent' : 'text-muted'}`}>
                0{i + 1} {label} {live(i) && <span className="animate-blink">&gt;</span>}
              </p>
              <p className={`mt-1 h-4 truncate text-[12px] leading-4 ${done || live(i) ? '' : 'text-muted'}`}>{value}</p>
            </div>
          </li>
        ))}
      </ol>

      <ul className="mt-3 grid" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}>
        {lanes.map((lane, i) => {
          const order = forks.findIndex((event) => event.horse_id === lane.horse.id)
          return (
            <Machine
              key={lane.horse.id}
              lane={lane}
              seen={seen}
              race={race}
              logged={logged}
              settled={settled}
              first={first}
              order={order < 0 ? i : order}
              column={i}
              edge={i === 0 ? 'ml-[50%]' : i === lanes.length - 1 ? 'mr-[50%]' : ''}
            />
          )
        })}
      </ul>

      {/* One time line per machine: the fork, each command, each check and the end. All machines work at the same time. */}
      {logged && (
        <div className="mt-3 border-2 border-line p-2">
          {lanes.map((lane) => {
            const own = seen.filter((event) => event.horse_id === lane.horse.id)
            const fork = own.find((event) => event.kind === 'fork_created')
            const end = own.find((event) => ENDS.includes(event.kind))
            return (
              <div key={lane.horse.id} className="flex items-center gap-2">
                <p className="w-40 shrink-0 truncate text-[11px] leading-4 text-muted">{lane.horse.name}</p>
                <div className="relative h-4 min-w-0 flex-1">
                  {/* The time in which the machine is alive. */}
                  {fork && <div className="absolute top-1.5 h-1 bg-line" style={{ left: `${x(ms(fork))}%`, width: `${x(end ? ms(end) : clockNow) - x(ms(fork))}%` }} />}
                  {own.map((event) => TICK[event.kind] && <div key={event.id} className={`absolute top-0 h-full ${TICK[event.kind]}`} style={{ left: `${x(ms(event))}%` }} />)}
                  {!settled && <div className="absolute top-0 h-full w-px bg-text" style={{ left: `${x(clockNow)}%` }} />}
                </div>
              </div>
            )
          })}
          <p className="mt-1 flex justify-between pl-42 text-[11px] leading-4 text-muted">
            <span>T+0</span>
            <span>T+{seconds(to - first)}</span>
          </p>
        </div>
      )}
    </section>
  )
}

function RaceGraph({ view, events, now, onError }: { view: LiveRace; events: RaceEvent[]; now: number; onError: (text: string) => void }) {
  const { race, lanes } = view
  const mine = events.filter((event) => event.race_id === race.id)
  const base = mine.find((event) => event.kind === 'base_built')
  const built = !!base || race.status !== 'open'
  const winner = lanes.find((lane) => lane.horse.id === race.winner_horse)?.horse.name
  const navigate = useNavigate()
  return (
    // A click at any place of the box opens the detail view of this race. The title is the same link for the keyboard.
    <section onClick={() => navigate(`/ops?race=${race.id}`)} className="flex min-w-0 cursor-pointer flex-col border-2 border-accent p-3 hover:bg-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/ops?race=${race.id}`} onClick={(event) => event.stopPropagation()} className="block truncate font-pixel text-[30px] leading-none">
            Race {race.id} <span className="text-muted">{ROOMS[race.task] ?? race.task}</span>
          </Link>
          <p className="mt-1 text-[12px] text-muted">{statusOf(race, now, winner)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <p className="font-pixel text-[15px] uppercase leading-none text-accent">Detail &gt;</p>
          <Start view={view} now={now} onError={onError} />
        </div>
      </div>

      {/* Disk, then the base room of this race, then one fork for each horse. */}
      <div className="mt-3 flex items-center justify-center">
        <Box label="Disk" value="derby" lit />
        <div className={`h-0.5 w-6 ${built ? 'bg-accent' : 'bg-line'}`} />
        <Box label="Base room" value={base?.text ?? (built ? `${race.task}${race.seed_revealed ? ` seed ${race.seed_revealed.slice(0, 8)}` : ''}` : 'not built')} lit={built} />
      </div>
      <div className={`mx-auto h-3 w-0.5 ${built ? 'bg-accent' : 'bg-line'}`} />
      <ul className="relative grid grid-cols-2 gap-x-6 gap-y-2">
        <div
          className={`absolute left-1/2 top-0 w-0.5 -translate-x-1/2 ${built ? 'bg-accent' : 'bg-line'}`}
          style={{ height: (Math.ceil(lanes.length / 2) - 1) * (NODE_H + ROW_GAP) + 22 }}
        />
        {lanes.map((lane, i) => (
          <Node key={lane.horse.id} lane={lane} events={mine} view={view} now={now} right={i % 2 === 1} />
        ))}
      </ul>
    </section>
  )
}

export default function Ops() {
  const { data: admin } = useIsAdmin()
  const { data: races } = useRaces()
  const { data: events = [] } = useRaceEvents(!!admin)
  const { data: forks = 0 } = useForksToday(!!admin)
  const client = useQueryClient()
  const now = useNow()
  // /ops?race=12 shows the machines of race 12.
  const picked = Number(useSearchParams()[0].get('race'))

  // The races that run, then the open races, then the newest settled races. Always 3 hooks, so the order of hooks is fixed.
  const rank = { running: 0, open: 1, settled: 2 }
  const ids = (races ?? [])
    .slice()
    .sort((a, b) => rank[a.race.status] - rank[b.race.status] || (a.race.status === 'settled' ? b.race.id - a.race.id : a.race.id - b.race.id))
    .slice(0, 3)
    .map(({ race }) => race.id)
  const views = [useRace(ids[0]).data, useRace(ids[1]).data, useRace(ids[2]).data].filter((view) => !!view)

  if (admin === undefined) return <p className="p-6 text-muted">Loading</p>
  if (!admin)
    return (
      <p className="p-6">
        This page is for admins.{' '}
        <Link to="/signin" className="text-accent">
          Sign in
        </Link>{' '}
        with an admin account.
      </p>
    )

  const running = views.filter((view) => view.race.status === 'running').flatMap((view) => view.lanes)
  const names = new Map(views.flatMap((view) => view.lanes.map((lane) => [lane.horse.id, lane.horse.name] as const)))
  const onError = (text: string) => {
    alert(text)
    client.invalidateQueries({ queryKey: ['races'] })
  }
  const age = events[0] ? now - Date.parse(events[0].at) : Infinity
  const numbers = [
    ['Sandboxes alive', String(running.filter((lane) => lane.entry.state === 'running').length)],
    ['Forks today', String(forks)],
    ['Cost of running races', usd(running.reduce((sum, lane) => sum + Number(lane.entry.cost_usd), 0))],
    ['Runner', age < 15_000 ? 'working' : events[0] ? `quiet for ${clock(age)}` : 'no event yet'],
    ['Disk', 'derby'],
  ]
  return (
    <main className="flex min-h-screen flex-col gap-3 p-6">
      <header className="flex flex-wrap items-end gap-x-10 gap-y-3 border-b-2 border-line pb-3">
        <h1 className="font-pixel text-[45px] leading-none text-accent">OPS</h1>
        {numbers.map(([label, value]) => (
          <div key={label}>
            <p className={LABEL}>{label}</p>
            <p className="mt-1 font-pixel text-[30px] leading-none">{value}</p>
          </div>
        ))}
        {/* The newest races that have events. A finished race is not in the overview, so this is the way to its replay. */}
        <div>
          <p className={LABEL}>Replay</p>
          <p className="mt-1 flex gap-4 font-pixel text-[30px] leading-none">
            {[...new Set(events.map((event) => event.race_id))].slice(0, 6).map((race) => (
              <Link key={race} to={`/ops?race=${race}`} className="text-accent">
                {race}
              </Link>
            ))}
            {events.length === 0 && '-'}
          </p>
        </div>
      </header>
      {/* /ops?race=12 shows only race 12, on the full width. */}
      {picked ? <Detail key={picked} id={picked} events={events} now={now} onError={onError} /> : null}
      <div className={`min-h-0 flex-1 items-start gap-3 xl:grid-cols-[repeat(3,minmax(0,1fr))_360px] ${picked ? 'hidden' : 'grid'}`}>
        {views.map((view) => (
          <RaceGraph key={view.race.id} view={view} events={events} now={now} onError={onError} />
        ))}
        {/* The events of the runner, newest first. */}
        <ol className="max-h-[calc(100vh-130px)] overflow-y-auto border-2 border-line p-3 text-[12px] leading-5 xl:col-start-4">
          {events.length === 0 && <li className="text-muted">No event yet. The runner writes events when a race starts.</li>}
          {events.slice(0, 200).map((event) => (
            <li key={event.id} className="truncate">
              <span className="text-muted">{time(event.at)}</span> R{event.race_id}{' '}
              <span className={['step', 'tool_call'].includes(event.kind) ? 'text-muted' : 'text-accent'}>{event.kind}</span>{' '}
              {event.horse_id && `${names.get(event.horse_id) ?? event.horse_id} `}
              <span className="text-muted">{event.kind === 'tool_call' ? `$ ${event.text}` : event.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  )
}
