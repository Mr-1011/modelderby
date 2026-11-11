// The race loop: keeps races open, runs one race at a time, settles it.
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Sandbox } from 'disk'
import type { Entry, Horse, Race } from '@horserace/shared'
import { finishOrder } from './finish.ts'
import { buildBase, disk, remove, removeLeftovers, runCheck } from './prepare.ts'

const RACE_MS = 180_000
const BUILD_MS = 20_000
const MAX_STEPS = 40
const OPEN_RACES = 3
const MINUTE = 60_000

const PROMPT =
  'You are locked in an escape room at /room. Read /room/README.txt. There are 5 locks; open as many as you can, ' +
  'all 5 to escape. Locks are independent. Run /room/check.sh to see which locks are open. Use only shell commands ' +
  'and file edits; there is no network. You have 3 minutes. Use the bash tool.'

const BASH_TOOL = {
  type: 'function',
  function: {
    name: 'bash',
    description: 'Run a shell command in /room. Returns stdout, stderr and the exit code.',
    parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
  },
}

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

type Lane = Entry & { horse: Horse }

// supabase-js returns an error instead of throwing it.
async function must<T>(query: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const lanesOf = (race: number) =>
  must(db.from('entries').select('*, horse:horses(*)').eq('race_id', race)) as Promise<Lane[]>
const patchEntry = (race: number, horse: string, patch: Partial<Entry>) =>
  must(db.from('entries').update(patch).eq('race_id', race).eq('horse_id', horse))

async function chat(lane: Lane, messages: unknown[], signal: AbortSignal) {
  const effort = lane.horse.reasoning_effort
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: lane.horse.model,
      messages,
      tools: [BASH_TOOL],
      // Reasoning tokens count too. 2000 cut off the scripts of the reasoning models.
      max_tokens: 8000,
      usage: { include: true },
      ...(effort && { reasoning: { effort } }),
    }),
  })
  const body = await response.json()
  if (!response.ok || body.error) {
    throw new Error(`OpenRouter ${response.status}: ${JSON.stringify(body.error ?? body).slice(0, 300)}`)
  }
  return body
}

// A submitted model must exist, take tools, and stay under the price limit (USD per million tokens).
async function allowedModels() {
  const { data } = await (await fetch('https://openrouter.ai/api/v1/models')).json()
  return new Set<string>(
    data
      .filter(
        (m: { id: string; supported_parameters?: string[]; pricing: { prompt: string; completion: string } }) =>
          !m.id.includes(':') &&
          m.supported_parameters?.includes('tools') &&
          Number(m.pricing.prompt) * 1e6 <= 5 &&
          Number(m.pricing.completion) * 1e6 <= 25,
      )
      .map((m: { id: string }) => m.id),
  )
}

// One horse: the model sends bash commands, the runner runs them in the fork and checks the locks after each one.
async function ride(
  lane: Lane,
  fork: Sandbox,
  check: string,
  started: number,
  signal: AbortSignal,
  queue: (write: () => PromiseLike<unknown>) => void,
) {
  const messages: unknown[] = [{ role: 'user', content: PROMPT }]
  // Three failed requests or answers without a command in a row end the race of this horse.
  let failures = 0
  while (lane.steps < MAX_STEPS && !signal.aborted) {
    let reply
    try {
      reply = await chat(lane, messages, signal)
    } catch (error) {
      if (signal.aborted) return
      console.error(lane.horse_id, error)
      if (++failures === 3) return
      await sleep(2000)
      continue
    }
    lane.tokens += reply.usage?.total_tokens ?? 0
    lane.cost_usd += reply.usage?.cost ?? 0
    const message = reply.choices[0].message
    messages.push(message)
    const calls = message.tool_calls ?? []
    if (!calls.length) {
      // A model that only talks gets a reminder.
      if (++failures === 3) return
      messages.push({ role: 'user', content: 'Use the bash tool to run commands. Run /room/check.sh to see your progress.' })
      continue
    }
    failures = 0
    for (const call of calls) {
      if (signal.aborted) return
      let command = ''
      let output: string
      try {
        // An answer that hits max_tokens can come with a tool call that has no command.
        const args = JSON.parse(call.function.arguments)
        if (typeof args.command !== 'string') throw new Error('the bash tool needs a "command" string. Send a shorter command.')
        command = args.command
        const result = await fork.exec('bash -c "$COMMAND"', { cwd: '/room', env: { COMMAND: command }, timeoutSeconds: 60 })
        output = `${result.stdout}${result.stderr}\n[exit ${result.exitCode ?? result.status}]`
      } catch (error) {
        output = `error: ${error}`
      }
      if (signal.aborted) return
      if (output.length > 6000) output = `${output.slice(0, 3000)}\n[...]\n${output.slice(-3000)}`
      messages.push({ role: 'tool', tool_call_id: call.id, content: output })

      const locks = await runCheck(fork, check).catch(() => lane.locks ?? '00000')
      if (signal.aborted) return
      const ms = Date.now() - started
      const open = locks.split('1').length - 1
      if (open > lane.locks_open) lane.last_lock_ms = ms
      lane.steps++
      lane.locks = locks
      lane.locks_open = open
      lane.last_step = command.replace(/\s+/g, ' ').slice(0, 120)
      if (open === 5) {
        lane.state = 'escaped'
        lane.solved_ms = ms
      }
      const { horse: _, ...row } = lane
      const line = JSON.stringify({ ms, step: lane.steps, command, output: output.slice(0, 4000), locks })
      queue(() => patchEntry(lane.race_id, lane.horse_id, row))
      queue(async () => (await disk()).appendObject(`races/${lane.race_id}/${lane.horse_id}/log.jsonl`, `${line}\n`))
      if (open === 5) return
    }
  }
}

export async function runRace(race: Race) {
  // The seed row is also the claim: a second runner process cannot take the same race.
  const seed = randomBytes(16).toString('hex')
  const { error: taken } = await db.from('race_secrets').insert({ race_id: race.id, seed })
  if (taken) return

  const allowed = await allowedModels()
  const { base, check } = await buildBase(`derby-r${race.id}-base`, race.task, seed)
  // The room is ready before the countdown ends. The entries close at the countdown, so the lanes are read after it.
  await sleep(Date.parse(race.countdown_ends_at!) - Date.now())
  const lanes = await lanesOf(race.id)
  const forks = new Map<string, Sandbox>()
  await Promise.all(
    lanes.map(async (lane) => {
      if (lane.horse.kind === 'submitted' && !allowed.has(lane.horse.model)) return
      await base.fork({ name: `derby-r${race.id}-${lane.horse_id}` }).then(
        (fork) => forks.set(lane.horse_id, fork),
        (error) => console.error(lane.horse_id, error),
      )
    }),
  )
  const running = lanes.filter((lane) => forks.has(lane.horse_id))
  const placeCount = running.length < 6 ? 2 : 3
  await Promise.all(
    lanes.map((lane) => {
      const fork = forks.get(lane.horse_id)
      lane.state = fork ? 'running' : 'failed'
      lane.sandbox_id = fork?.id ?? null
      return patchEntry(race.id, lane.horse_id, { state: lane.state, sandbox_id: lane.sandbox_id })
    }),
  )
  const started = Date.now()
  await must(
    db.from('races').update({ status: 'running', started_at: new Date(started).toISOString(), place_count: placeCount }).eq('id', race.id),
  )

  // Writes go in order, and they do not hold up the horses.
  let writes: Promise<unknown> = Promise.resolve()
  const queue = (write: () => PromiseLike<unknown>) => {
    writes = writes.then(write).catch((error) => console.error(error))
  }
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), RACE_MS)
  const stopped = new Promise((resolve) => stop.signal.addEventListener('abort', resolve))
  let escaped = 0
  await Promise.all(
    running.map((lane) =>
      // A horse that waits for a slow command does not hold up the end of the race.
      Promise.race([
        stopped,
        ride(lane, forks.get(lane.horse_id)!, check, started, stop.signal, queue)
          .catch((error) => console.error(lane.horse_id, error))
          .then(() => {
            if (lane.state !== 'escaped') return
            if (++escaped === 1) {
              queue(() =>
                must(db.from('races').update({ betting_closed_at: new Date().toISOString(), winner_horse: lane.horse_id }).eq('id', race.id)),
              )
            }
            if (escaped >= Math.min(placeCount, running.length)) stop.abort()
          }),
      ]),
    ),
  )
  stop.abort()
  clearTimeout(timer)
  await writes

  // The final state of every room goes to the disk: the diff, the room and the result.
  const files = await disk()
  await Promise.all(
    running.map(async (lane) => {
      const fork = forks.get(lane.horse_id)!
      try {
        const locks = await runCheck(fork, check)
        const open = locks.split('1').length - 1
        if (open > lane.locks_open) lane.last_lock_ms = RACE_MS
        lane.locks = locks
        lane.locks_open = open
        lane.diff = (await fork.exec('git add -A && git diff --cached', { cwd: '/room', timeoutSeconds: 30 })).stdout
        const room = (await fork.exec('tar czf - -C / room | base64 -w0', { timeoutSeconds: 60 })).stdout
        const at = `races/${race.id}/${lane.horse_id}`
        await files.putObject(`${at}/final.diff`, lane.diff, 'text/plain')
        await files.putObject(`${at}/room.tar.gz`, Buffer.from(room, 'base64'), 'application/gzip')
      } catch (error) {
        console.error(lane.horse_id, error)
      }
      if (lane.state !== 'escaped') lane.state = 'timeout'
    }),
  )
  await finish(race.id, lanes)
  await Promise.allSettled([...forks.values()].map(remove))
  await remove(base).catch((error) => console.error(error))
}

// Writes the finish order and the results, then pays out.
async function finish(race: number, lanes: Lane[]) {
  const order = finishOrder(lanes)
  const files = await disk()
  await Promise.all(
    lanes.map(async (lane) => {
      const { horse, ...row } = lane
      row.finish_pos = order.indexOf(lane.horse_id) + 1
      // shortcut: a diff above 200 kB is cut in the table, the full diff is on the Archil disk.
      await patchEntry(race, lane.horse_id, { ...row, diff: row.diff?.slice(0, 200_000) ?? null })
      const result = { ...row, diff: undefined, horse: horse.name, model: horse.model }
      await files
        .putObject(`races/${race}/${lane.horse_id}/result.json`, JSON.stringify(result), 'application/json')
        .catch((error) => console.error(error))
    }),
  )
  await must(db.rpc('settle_race', { p_race: race }))
}

async function tick() {
  const open = (await must(
    db.from('races').select('*').eq('status', 'open').order('countdown_ends_at'),
  )) as Race[]
  let latest = Math.max(0, ...open.map((race) => Date.parse(race.countdown_ends_at!)))
  for (let n = open.length; n < OPEN_RACES; n++) {
    latest = Math.max(Date.now() + 3 * MINUTE, latest + 6 * MINUTE)
    await must(db.rpc('open_race', { p_task: 'vault', p_countdown_ends_at: new Date(latest).toISOString() }))
  }
  // The room build takes about 15 s, so it starts before the countdown ends.
  const due = open[0]
  if (due && Date.parse(due.countdown_ends_at!) - BUILD_MS <= Date.now()) await runRace(due)
}

// After a crash: free the sandboxes, release the races that never started, and settle a race that was running.
async function recover() {
  await removeLeftovers()
  const races = (await must(db.from('races').select('*').in('status', ['open', 'running']))) as Race[]
  for (const race of races) {
    if (race.status === 'open') {
      await must(db.from('race_secrets').delete().eq('race_id', race.id))
      continue
    }
    const lanes = await lanesOf(race.id)
    for (const lane of lanes) if (lane.state === 'running' || lane.state === 'waiting') lane.state = 'timeout'
    await finish(race.id, lanes)
  }
}

export async function loop() {
  await recover().catch((error) => console.error(error))
  for (;;) {
    await tick().catch((error) => console.error(error))
    await sleep(5000)
  }
}
