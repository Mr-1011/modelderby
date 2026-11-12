// A trial race for the balance of the levels: the house horses run one room at one level, with the same horse loop
// and checker as a real race, but with no race row, no bets and no Realtime. Run from backend/:
//   node --env-file=.env src/trial.ts <room> <level> [horse ids, for example h4,h5,h6]
// The result goes to the console and as one JSON line to backups/trials.jsonl (git-ignored).
import { randomBytes } from 'node:crypto'
import { appendFile } from 'node:fs/promises'
import type { Sandbox } from 'disk'
import { finishOrder } from '@modelderby/shared'
import type { Horse } from '@modelderby/shared'
import { buildBase, remove, runCheck } from './prepare.ts'
import { CHECK_MS, db, type Lane, RACE_MS, record, ride } from './race.ts'

const [room, levelArg, only] = process.argv.slice(2)
const level = Number(levelArg)
if (!room || ![1, 2, 3].includes(level)) throw new Error('usage: src/trial.ts <room> <level 1-3> [horse ids]')

const { data: horses, error } = await db.from('horses').select('*').eq('kind', 'house').eq('active', true).order('id')
if (error) throw new Error(error.message)
const field = (horses as Horse[]).filter((horse) => !only || only.split(',').includes(horse.id))

const seed = randomBytes(16).toString('hex')
// The names do not start with "derby-r", so the runner leaves these sandboxes alone.
const name = `derby-trial-${room}-${level}-${seed.slice(0, 6)}`
const { base, check } = await buildBase(`${name}-base`, room, seed, level)
const forks = new Map<string, Sandbox>()
await Promise.all(field.map(async (horse) => forks.set(horse.id, await base.fork({ name: `${name}-${horse.id}` }))))
const lanes = field.map(
  (horse) =>
    ({
      race_id: 0, horse_id: horse.id, sandbox_id: forks.get(horse.id)!.id, state: 'running', locks_open: 0, locks: null,
      steps: 0, last_step: null, cost_usd: 0, tokens: 0, solved_ms: null, last_lock_ms: null, finish_pos: null,
      diff: null, progress: 0, view: null, horse,
    }) as Lane,
)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const started = Date.now()
const stop = new AbortController()
const timer = setTimeout(() => stop.abort(), RACE_MS)
const stopped = new Promise((resolve) => stop.signal.addEventListener('abort', resolve))
await Promise.all(
  lanes.map((lane) => {
    const fork = forks.get(lane.horse_id)!
    const own = new AbortController()
    const signal = AbortSignal.any([stop.signal, own.signal])
    let last: Promise<unknown> = Promise.resolve()
    const update = () =>
      (last = last.then(async () => {
        const result = await runCheck(fork, check).catch(() => null)
        if (signal.aborted || !result) return
        record(lane, result, Date.now() - started)
        if (lane.state !== 'running') own.abort()
      }))
    void (async () => {
      while (!signal.aborted) {
        await sleep(CHECK_MS)
        if (!signal.aborted) await update()
      }
    })()
    return Promise.race([
      stopped,
      ride(lane, fork, signal, update, () => {})
        .catch((error) => console.error(lane.horse_id, error))
        .finally(() => own.abort()),
    ])
  }),
)
const end = Math.min(Date.now() - started, RACE_MS)
stop.abort()
clearTimeout(timer)
// The last look at each room, like in a real race.
await Promise.all(lanes.map(async (lane) => record(lane, await runCheck(forks.get(lane.horse_id)!, check), end)))
for (const lane of lanes) if (lane.state === 'running') lane.state = 'timeout'

const order = finishOrder(lanes)
const rows = order.map((id, i) => {
  const lane = lanes.find((lane) => lane.horse_id === id)!
  return {
    pos: i + 1, horse: lane.horse.name, model: lane.horse.model, state: lane.state, progress: lane.progress,
    cost_usd: Number(lane.cost_usd.toFixed(4)), steps: lane.steps, solved_s: lane.solved_ms && Math.round(lane.solved_ms / 1000),
  }
})
console.log(`${room} level ${level} seed ${seed.slice(0, 6)}`)
console.table(rows)
await appendFile(
  new URL('../../backups/trials.jsonl', import.meta.url),
  `${JSON.stringify({ at: new Date().toISOString(), room, level, seed, rows })}\n`,
)
await Promise.allSettled([...forks.values()].map(remove))
await remove(base)
