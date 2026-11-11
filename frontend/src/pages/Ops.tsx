import type { RaceEvent } from '@horserace/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { clock, usd } from '../lib/format'
import { type LiveRace, startRace, useForksToday, useIsAdmin, useNow, useRace, useRaceEvents, useRaces } from '../lib/queries'
import { type Lane, ROOMS, statusOf } from '../lib/race'

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
      onClick={() =>
        startRace(race.id).then(
          () => client.invalidateQueries({ queryKey: ['races'] }),
          (failure: Error) => onError(failure.message),
        )
      }
      className="h-9 shrink-0 bg-accent px-3 font-pixel text-[15px] uppercase leading-none text-on-accent disabled:bg-line disabled:text-muted"
    >
      Start now
    </button>
  )
}

// The files that the runner writes to the disk for each horse. The first one grows during the race.
const FILES = ['log.jsonl', 'final.diff', 'room.tar.gz', 'result.json']

// One machine of the detail view: the fork of one horse. order is its place in the order of the forks.
function Machine({ lane, events, view, now, order, edge }: { lane: Lane; events: RaceEvent[]; view: LiveRace; now: number; order: number; edge: string }) {
  const { horse, entry } = lane
  const { race } = view
  const mine = events.filter((event) => event.horse_id === horse.id)
  const steps = mine.filter((event) => event.kind === 'step')
  const calls = mine.filter((event) => event.kind === 'tool_call')
  const flash = mine.find((event) => ['tool_call', 'checkpoint', 'solved', 'out'].includes(event.kind))
  // The runner has no events for an old race. The entry then still has the id of the machine.
  const [sandbox, ms] = mine.find((event) => event.kind === 'fork_created')?.text?.split(' ') ?? [entry.sandbox_id]
  const racing = race.status === 'running'
  const state = stateText(lane, racing)
  const elapsed = entry.solved_ms ?? (racing && race.started_at ? now - Date.parse(race.started_at) : 0)
  const tokensIn = steps.reduce((sum, event) => sum + (event.tokens_in ?? 0), 0)
  const tokensOut = steps.reduce((sum, event) => sum + (event.tokens_out ?? 0), 0)
  const lines = calls.length ? calls.slice(0, 8).reverse().map((event) => event.text ?? '') : entry.last_step ? [entry.last_step] : []
  const logged = entry.steps > 0
  const delay = { animationDelay: `${order * 150}ms` }
  return (
    <li className="min-w-0">
      {/* The piece of the trunk above this machine, then the branch. */}
      <div className={`h-0.5 ${edge} ${sandbox ? 'bg-accent' : 'bg-line'}`} />
      <div className={`mx-auto h-4 w-0.5 ${sandbox ? 'bg-accent' : 'bg-line'}`} />
      <div className="px-1">
        {sandbox ? (
          <div className="overflow-hidden">
            <div className={`relative h-84 animate-rise overflow-hidden border-2 border-accent p-2 ${entry.state === 'running' ? 'bg-panel' : ''}`} style={delay}>
              <div className="pointer-events-none absolute inset-0 animate-flash bg-accent" style={delay} />
              {flash && <div key={flash.id} className="pointer-events-none absolute inset-0 animate-flash bg-accent" />}
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-pixel text-[15px] uppercase leading-none text-accent">VM {order + 1}</p>
                <p className={`font-pixel text-[15px] uppercase leading-none ${state === 'running' || state === 'solved' ? 'text-accent' : 'text-muted'}`}>{state}</p>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted">{sandbox}</p>
              <p className="text-[11px] text-muted">{ms ? `fork ${ms} ms` : 'forked'}</p>
              <p className="mt-2 truncate font-pixel text-[22.5px] leading-none">{horse.name}</p>
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
                step {entry.steps}/{MAX_STEPS}, {clock(elapsed)}
              </p>
              <p className="truncate text-[11px] text-muted">
                {steps.length ? `${kilo(tokensIn)} in ${kilo(tokensOut)} out, ${calls.length} calls` : `${kilo(entry.tokens)} tokens`}
              </p>
              <div className="mt-1 text-[11px] leading-4">
                {lines.map((line, i) => (
                  <p key={i} className={`truncate ${i === lines.length - 1 ? '' : 'text-muted'}`}>
                    $ {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid h-84 place-items-center border-2 border-dashed border-line p-2">
            <p className="text-center font-pixel text-[22.5px] leading-none text-muted">{horse.name}</p>
          </div>
        )}
        {/* What the runner keeps of this machine on the disk. */}
        <div className={`mx-auto h-3 w-0.5 ${logged ? 'bg-accent' : 'bg-line'}`} />
        <div className={`border-2 p-2 text-[11px] leading-4 ${logged ? 'border-accent' : 'border-line'}`}>
          <p className="truncate text-muted">
            races/{race.id}/{horse.id}/
          </p>
          {FILES.map((file, i) => (
            <p key={file} className={(i === 0 ? logged : race.status === 'settled') ? '' : 'text-muted'}>
              {file}
            </p>
          ))}
        </div>
      </div>
    </li>
  )
}

// One race in detail: the disk, the base room that is built once, and one machine per horse that forks from it.
function Detail({ id, events, now, onError }: { id: number; events: RaceEvent[]; now: number; onError: (text: string) => void }) {
  const { data: view } = useRace(id)
  // A new key mounts the graph again, so the forks come up again.
  const [run, setRun] = useState(0)
  if (!view) return <p className="text-muted">Loading</p>
  const { race, lanes } = view
  const mine = events.filter((event) => event.race_id === id)
  const [, baseId, baseMs] = mine.find((event) => event.kind === 'base_built')?.text?.split(' ') ?? []
  const built = !!baseId || race.status !== 'open'
  // Oldest first: the order in which the machines came up.
  const forks = mine.filter((event) => event.kind === 'fork_created').reverse()
  const times = forks.map((event) => Number(event.text?.split(' ')[1]))
  const winner = lanes.find((lane) => lane.horse.id === race.winner_horse)?.horse.name
  const numbers = [
    ['Machines', String(lanes.filter((lane) => lane.entry.sandbox_id || forks.some((event) => event.horse_id === lane.horse.id)).length)],
    ['Fork, average', forks.length ? `${Math.round(times.reduce((sum, ms) => sum + ms, 0) / forks.length)} ms` : '-'],
    ['First to last fork', forks.length ? `${Date.parse(forks.at(-1)!.at) - Date.parse(forks[0].at)} ms` : '-'],
  ]
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
        {numbers.map(([label, value]) => (
          <div key={label}>
            <p className={LABEL}>{label}</p>
            <p className="mt-1 font-pixel text-[30px] leading-none">{value}</p>
          </div>
        ))}
        <div className="ml-auto flex gap-2">
          <button onClick={() => setRun(run + 1)} className="h-9 border-2 border-text px-3 font-pixel text-[15px] uppercase leading-none">
            Replay
          </button>
          <Start view={view} now={now} onError={onError} />
        </div>
      </div>
      <p className="mt-2 text-[12px] text-muted">One runner process holds all agent loops. A machine gets work only when its horse calls bash.</p>

      <div key={run} className="mt-3">
        <div className="mx-auto w-80">
          <Box label="Disk" value={`derby  rooms/${race.task}/`} lit />
          <div className={`mx-auto h-3 w-0.5 ${built ? 'bg-accent' : 'bg-line'}`} />
          <div className={built ? 'animate-wipe' : ''}>
            <Box label="Base sandbox" value={baseId ? `${baseId}  built in ${baseMs} ms` : built ? race.task : 'not built'} lit={built} />
          </div>
          <div className={`mx-auto h-3 w-0.5 ${built ? 'bg-accent' : 'bg-line'}`} />
        </div>
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}>
          {lanes.map((lane, i) => {
            const order = forks.findIndex((event) => event.horse_id === lane.horse.id)
            return (
              <Machine
                key={lane.horse.id}
                lane={lane}
                events={mine}
                view={view}
                now={now}
                order={order < 0 ? i : order}
                edge={i === 0 ? 'ml-[50%]' : i === lanes.length - 1 ? 'mr-[50%]' : ''}
              />
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function RaceGraph({ view, events, now, onError }: { view: LiveRace; events: RaceEvent[]; now: number; onError: (text: string) => void }) {
  const { race, lanes } = view
  const mine = events.filter((event) => event.race_id === race.id)
  const base = mine.find((event) => event.kind === 'base_built')
  const built = !!base || race.status !== 'open'
  const winner = lanes.find((lane) => lane.horse.id === race.winner_horse)?.horse.name
  return (
    <section className="flex min-w-0 flex-col border-2 border-accent p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* The title opens the machines of this race. */}
          <Link to={`/ops?race=${race.id}`} className="block truncate font-pixel text-[30px] leading-none">
            Race {race.id} <span className="text-muted">{ROOMS[race.task] ?? race.task}</span>
          </Link>
          <p className="mt-1 text-[12px] text-muted">{statusOf(race, now, winner)}</p>
        </div>
        <Start view={view} now={now} onError={onError} />
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
  const feed = picked ? events.filter((event) => event.race_id === picked) : events
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
      </header>
      <div className={`grid min-h-0 flex-1 items-start gap-3 ${picked ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'xl:grid-cols-[repeat(3,minmax(0,1fr))_360px]'}`}>
        {picked ? (
          <Detail id={picked} events={events} now={now} onError={onError} />
        ) : (
          views.map((view) => <RaceGraph key={view.race.id} view={view} events={events} now={now} onError={onError} />)
        )}
        {/* The events of the runner, newest first. */}
        <ol className={`max-h-[calc(100vh-130px)] overflow-y-auto border-2 border-line p-3 text-[12px] leading-5 ${picked ? '' : 'xl:col-start-4'}`}>
          {feed.length === 0 && <li className="text-muted">No event yet. The runner writes events when a race starts.</li>}
          {feed.slice(0, 200).map((event) => (
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
