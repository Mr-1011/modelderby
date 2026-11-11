import { type Challenge, type Entry, finishOrder, type Horse, type Race } from '@horserace/shared'
import { useEffect, useState } from 'react'
import { RACE_MS, type RaceView } from './race'

// A fake race for design work, at /board?demo and /?demo. Nothing in this file is real data.

// name, model, provider, size class, strength (how fast the fake horse opens locks)
const LINEUP: [string, string, string, Horse['size_class'], number][] = [
  ['Midnight Diff', 'demo/frontier-large', 'Demo Labs', 'frontier', 1.3],
  ['Segfault Sally', 'demo/open-70b', 'Demo Labs', 'open-weight', 0.6],
  ['Sudo Sprint', 'demo/frontier-pro', 'Demo Labs', 'frontier', 1.15],
  ['Off By One', 'demo/small-mini', 'Demo Labs', 'small', 0.45],
  ['Kernel Panic', 'demo/open-coder', 'Demo Labs', 'open-weight', 0.8],
  ['Tab Complete', 'demo/frontier-fast', 'Demo Labs', 'frontier', 1.0],
  ['Merge Conflict', 'demo/small-nano', 'Demo Labs', 'small', 0.35],
  ['Null Pointer', 'demo/open-32b', 'Demo Labs', 'open-weight', 0.7],
]

const HORSES: Horse[] = LINEUP.map(([name, model, provider, size_class], i) => ({
  id: `h${i + 1}`, name, model, provider, size_class, reasoning_effort: null, kind: 'house', submitted_by: null, active: true, vision: false,
}))

const BLURBS = [
  'Find one number hidden in rotated server logs.',
  'Open an encrypted file with a known header.',
  'Fix a billing bug from an issue report.',
  'Find the rule of a grid puzzle and apply it.',
  'Find the cheapest route through a map.',
]
const CHALLENGES: Challenge[] = BLURBS.map((public_blurb, i) => ({
  id: `vault-${i + 1}`, room: 'vault', lock: i + 1, category: i === 3 ? 'image' : 'text', public_blurb,
}))

const COMMANDS = [
  'cat README.txt', './check.sh', 'ls -la', 'cat TASK.txt', 'python3 solve.py', 'git diff --stat',
  'sort data.txt | uniq -c | sort -rn | head', 'python3 -m unittest -q', 'grep -rn "def " src | head -20',
  'head -c 64 input.bin | xxd', 'python3 search.py --depth 6 > answers/out.txt',
]

type Sim = { race: Race; entries: Entry[]; stakes: number[]; next: number[] }

const OPEN_MS = 12_000
const RESULT_MS = 12_000

function open(id: number, now: number): Sim {
  return {
    race: {
      id, task: 'vault', status: 'open', opens_at: new Date(now).toISOString(),
      countdown_ends_at: new Date(now + OPEN_MS).toISOString(), ready: true, started_at: null, betting_closed_at: null,
      ended_at: null, place_count: 3, winner_horse: null, place_horses: null, seed_revealed: null,
    },
    entries: HORSES.map((horse) => ({
      race_id: id, horse_id: horse.id, sandbox_id: null, state: 'waiting', locks_open: 0, locks: '00000', steps: 0,
      last_step: null, cost_usd: 0, tokens: 0, solved_ms: null, last_lock_ms: null, finish_pos: null, diff: null,
      progress: 0, view: null,
    })),
    stakes: HORSES.map(() => 250),
    next: [],
  }
}

const gap = (i: number, locks: number) => ((2500 + Math.random() * 5000) * (1 + locks * 0.4)) / LINEUP[i][4]

function step(sim: Sim, now: number): Sim {
  let { race, entries, next } = sim
  const stakes = sim.stakes.slice()
  const iso = new Date(now).toISOString()

  if (race.status === 'settled') return now - Date.parse(race.ended_at!) > RESULT_MS ? open(race.id + 1, now) : sim

  // A fake bet, more often on a strong horse.
  if (!race.betting_closed_at) {
    const i = Math.floor(Math.random() * HORSES.length)
    if (Math.random() < LINEUP[i][4]) stakes[i] += 50 * (1 + Math.floor(Math.random() * 5))
  }

  if (race.status === 'open') {
    if (now < Date.parse(race.countdown_ends_at!)) return { ...sim, stakes }
    race = { ...race, status: 'running', started_at: iso }
    entries = entries.map((entry) => ({ ...entry, state: 'running' }))
    next = entries.map((_, i) => now + gap(i, 0))
  }

  const elapsed = now - Date.parse(race.started_at!)
  entries = entries.map((entry, i) => {
    if (entry.state !== 'running') return entry
    const moved = {
      ...entry, steps: entry.steps + 1, cost_usd: entry.cost_usd + 0.004 * LINEUP[i][4],
      last_step: COMMANDS[Math.floor(Math.random() * COMMANDS.length)],
    }
    if (now < next[i]) return Math.random() < 0.3 ? moved : entry
    const locks_open = entry.locks_open + 1
    next[i] = now + gap(i, locks_open)
    return {
      ...moved, locks_open, progress: locks_open * 20, locks: '1'.repeat(locks_open).padEnd(5, '0'), last_lock_ms: elapsed,
      ...(locks_open === 5 ? { state: 'escaped' as const, solved_ms: elapsed } : {}),
    }
  })

  const escaped = entries.filter((entry) => entry.state === 'escaped')
  if (escaped.length && !race.betting_closed_at) race = { ...race, betting_closed_at: iso }
  if (escaped.length >= race.place_count || elapsed >= RACE_MS) {
    const order = finishOrder(entries)
    entries = entries.map((entry) => ({
      ...entry, state: entry.state === 'running' ? 'timeout' : entry.state, finish_pos: order.indexOf(entry.horse_id) + 1,
    }))
    race = {
      ...race, status: 'settled', ended_at: iso, betting_closed_at: race.betting_closed_at ?? iso,
      winner_horse: order[0], place_horses: order.slice(0, race.place_count),
    }
  }
  return { race, entries, stakes, next }
}

export function useDemoRace(): RaceView {
  const [sim, setSim] = useState(() => open(12, Date.now()))
  useEffect(() => {
    const timer = setInterval(() => setSim((current) => step(current, Date.now())), 500)
    return () => clearInterval(timer)
  }, [])

  // The pari-mutuel formulas of the brief, on the fake stakes.
  const pool = sim.stakes.reduce((sum, stake) => sum + stake, 0)
  const n = HORSES.length
  const k = sim.race.place_count
  return {
    race: sim.race,
    challenges: CHALLENGES,
    pool: (pool - 2000) * 4,
    lanes: HORSES.map((horse, i) => ({
      horse,
      entry: sim.entries[i],
      win: pool / sim.stakes[i],
      place: 1 + ((pool - sim.stakes[i]) * (n - k)) / (k * (n - 1) * sim.stakes[i]),
    })),
  }
}
