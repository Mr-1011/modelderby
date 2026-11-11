// The race loop: keeps races open, runs one race at a time, settles it.
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Sandbox } from 'disk'
import { finishOrder } from '@horserace/shared'
import type { Entry, Horse, Race } from '@horserace/shared'
import { buildBase, disk, remove, removeLeftovers, runCheck } from './prepare.ts'

const RACE_MS = 180_000
const BUILD_MS = 20_000
const CHECK_MS = 3000
const MAX_STEPS = 40
const OPEN_RACES = 3
const ROOMS = ['cube', 'rover', 'vault'] // the order of the rooms for new races
const MINUTE = 60_000
// With the flag on, a horse goes out when its cost is above the cost of a horse that finished.
const ELIMINATE = ['1', 'true'].includes(process.env.LIVE_ELIMINATION ?? '')

// The prompt is neutral: it does not tell the horse how the race is scored.
const prompt = (task: string) =>
  `Your task is in ${task === 'vault' ? '/room/README.txt' : '/room/TASK.md'}. Solve it with shell commands: use the bash tool. ` +
  'Run /room/check.sh to see your progress. You have 3 minutes.'

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

// One row of race_events for the admin view. The time is the time of the event, not of the write.
// Never put the output of a command, the seed or a check script into an event.
type EventFields = { horse_id?: string; text?: string; cost_usd?: number; tokens_in?: number; tokens_out?: number }
function raceEvent(race: number, kind: string, fields: EventFields) {
  const row = { race_id: race, kind, at: new Date().toISOString(), ...fields }
  // An event that is not saved must not stop a race.
  return async () => {
    const { error } = await db.from('race_events').insert(row)
    if (error) console.error('race_events', kind, error.message)
  }
}
// The first words of what the model wrote before its tool call.
const firstWords = (content: unknown) => (typeof content === 'string' ? content.trim().split(/\s+/).slice(0, 3).join(' ') : '')

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

// Puts a checker result into the entry of a horse. A running horse at 100 has finished.
// The finish is final: a later move in the room can lower the progress, but not for a finished horse.
function record(lane: Lane, result: Awaited<ReturnType<typeof runCheck>>, ms: number) {
  if (lane.state === 'escaped') return
  if (result.progress > lane.progress) lane.last_lock_ms = ms
  Object.assign(lane, result)
  if (lane.progress === 100 && lane.state === 'running') {
    lane.state = 'escaped'
    lane.solved_ms = ms
  }
}

// One horse: the model sends bash commands, the runner runs them in the fork and calls update after each one.
async function ride(
  lane: Lane,
  fork: Sandbox,
  task: string,
  signal: AbortSignal,
  update: (command: string, output: string) => Promise<unknown>,
  event: (kind: string, fields: EventFields) => void,
) {
  const messages: unknown[] = [{ role: 'user', content: prompt(task) }]
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
    event('step', {
      horse_id: lane.horse_id,
      text: firstWords(message.content),
      cost_usd: reply.usage?.cost ?? 0,
      tokens_in: reply.usage?.prompt_tokens,
      tokens_out: reply.usage?.completion_tokens,
    })
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
      lane.steps++
      lane.last_step = command.replace(/\s+/g, ' ').slice(0, 120)
      event('tool_call', { horse_id: lane.horse_id, text: lane.last_step })
      // The update stops this horse when it finished or went out.
      await update(command, output)
    }
  }
}

export async function runRace(race: Race) {
  // The seed row is also the claim: a second runner process cannot take the same race.
  const seed = randomBytes(16).toString('hex')
  const { error: taken } = await db.from('race_secrets').insert({ race_id: race.id, seed })
  if (taken) return

  // Writes go in order, and they do not hold up the horses.
  let writes: Promise<unknown> = Promise.resolve()
  const queue = (write: () => PromiseLike<unknown>) => {
    writes = writes.then(write).catch((error) => console.error(error))
  }
  const event = (kind: string, fields: EventFields) => queue(raceEvent(race.id, kind, fields))
  // The end of a horse: solved, out or timeout, with its progress and its total cost.
  const ended = (lane: Lane) =>
    event(lane.state === 'escaped' ? 'solved' : lane.state, { horse_id: lane.horse_id, text: String(lane.progress), cost_usd: lane.cost_usd })

  const allowed = await allowedModels()
  const built = Date.now()
  const { base, check } = await buildBase(`derby-r${race.id}-base`, race.task, seed)
  event('base_built', { text: `${race.task} ${base.id} ${Date.now() - built} ms` })
  // The room is ready before the countdown ends. The entries close at the countdown, so the lanes are read after it.
  await sleep(Math.max(0, Date.parse(race.countdown_ends_at!) - Date.now()))
  const lanes = await lanesOf(race.id)
  const forks = new Map<string, Sandbox>()
  await Promise.all(
    lanes.map(async (lane) => {
      const failed = (text: string) => event('failed', { horse_id: lane.horse_id, text: text.slice(0, 120) })
      if (lane.horse.kind === 'submitted' && !allowed.has(lane.horse.model)) {
        return failed('the model is not on OpenRouter, has no tools or is above the price limit')
      }
      const forked = Date.now()
      await base.fork({ name: `derby-r${race.id}-${lane.horse_id}` }).then(
        (fork) => {
          forks.set(lane.horse_id, fork)
          event('fork_created', { horse_id: lane.horse_id, text: `${fork.id} ${Date.now() - forked} ms` })
        },
        (error) => {
          console.error(lane.horse_id, error)
          failed(String(error?.message ?? error))
        },
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

  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), RACE_MS)
  const stopped = new Promise((resolve) => stop.signal.addEventListener('abort', resolve))
  let finished = 0
  let lowest = Infinity // the lowest cost of a horse that finished
  // The race ends when each horse has finished, gone out or stopped, or at the time limit.
  await Promise.all(
    running.map((lane) => {
      const fork = forks.get(lane.horse_id)!
      // Stops this horse only.
      const own = new AbortController()
      const signal = AbortSignal.any([stop.signal, own.signal])
      // Runs the checker and writes the entry. The updates of one horse run one after the other.
      let last: Promise<unknown> = Promise.resolve()
      const update = (command?: string, output?: string) =>
        (last = last
          .then(async () => {
            const result = await runCheck(fork, check).catch(() => null)
            if (signal.aborted) return
            const ms = Date.now() - started
            const before = lane.progress
            if (result) record(lane, result, ms)
            if (lane.progress > before) event('checkpoint', { horse_id: lane.horse_id, text: String(lane.progress) })
            if (lane.state === 'escaped') {
              lowest = Math.min(lowest, lane.cost_usd)
              // Betting closes at the first finish. settle_race sets the winner, because the lowest cost wins.
              if (++finished === 1) {
                queue(() => must(db.from('races').update({ betting_closed_at: new Date().toISOString() }).eq('id', race.id)))
              }
            } else if (ELIMINATE && lane.cost_usd > lowest) lane.state = 'out'
            if (lane.state !== 'running') {
              own.abort()
              ended(lane)
            }
            const { horse: _, ...row } = lane
            queue(() => patchEntry(race.id, lane.horse_id, row))
            if (command === undefined) return
            const line = JSON.stringify({ ms, step: lane.steps, command, output: output!.slice(0, 4000), progress: lane.progress, locks: lane.locks })
            queue(async () => (await disk()).appendObject(`races/${race.id}/${lane.horse_id}/log.jsonl`, `${line}\n`))
          })
          .catch((error) => console.error(lane.horse_id, error)))
      // A script of the agent can change the room without a new command, so the checker also runs on a timer.
      void (async () => {
        while (!signal.aborted) {
          await sleep(CHECK_MS)
          if (!signal.aborted) await update()
        }
      })()
      // A horse that waits for a slow command does not hold up the end of the race.
      return Promise.race([
        stopped,
        ride(lane, fork, race.task, signal, update, event)
          .catch((error) => console.error(lane.horse_id, error))
          .finally(() => own.abort()),
      ])
    }),
  )
  const end = Math.min(Date.now() - started, RACE_MS)
  stop.abort()
  clearTimeout(timer)
  await writes

  // The final state of every room goes to the disk: the diff, the room and the result.
  const files = await disk()
  await Promise.all(
    running.map(async (lane) => {
      const fork = forks.get(lane.horse_id)!
      const before = { ...lane }
      try {
        // The last look at the room: a horse can reach 100 after its last check.
        record(lane, await runCheck(fork, check), end)
        if (lane.progress > before.progress) event('checkpoint', { horse_id: lane.horse_id, text: String(lane.progress) })
        // A room without a git repository gives the command log of its CLI as the diff.
        const diff = '(git add -A && git diff --cached) 2>/dev/null || cat .cube/moves.log .robot/commands.log 2>/dev/null'
        lane.diff = (await fork.exec(diff, { cwd: '/room', timeoutSeconds: 30 })).stdout
        const room = (await fork.exec('tar czf - -C / room | base64 -w0', { timeoutSeconds: 60 })).stdout
        const at = `races/${race.id}/${lane.horse_id}`
        await files.putObject(`${at}/final.diff`, lane.diff, 'text/plain')
        await files.putObject(`${at}/room.tar.gz`, Buffer.from(room, 'base64'), 'application/gzip')
      } catch (error) {
        console.error(lane.horse_id, error)
      }
      if (lane.state === 'running') lane.state = 'timeout'
      if (lane.state !== before.state) ended(lane)
    }),
  )
  await writes
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
  await raceEvent(race, 'settled', { text: order[0] })()
}

async function tick() {
  const open = (await must(db.from('races').select('*').eq('status', 'open'))) as Race[]
  // The countdown of a race that waits for its first player can be in the past, so a new race counts from now.
  let latest = Math.max(0, ...open.map((race) => Date.parse(race.countdown_ends_at!)))
  if (open.length < OPEN_RACES) {
    // A new race takes the next room after the room of the newest race, from the rooms that are on the disk.
    const { commonPrefixes } = await (await disk()).listObjects('rooms/')
    const rooms = ROOMS.filter((room) => commonPrefixes?.includes(`rooms/${room}/`))
    const [newest] = (await must(db.from('races').select('task').order('id', { ascending: false }).limit(1))) as Race[]
    let task = newest?.task
    for (let n = open.length; n < OPEN_RACES; n++) {
      latest = Math.max(Date.now(), latest) + 6 * MINUTE
      task = rooms[(rooms.indexOf(task) + 1) % rooms.length]
      await must(db.rpc('open_race', { p_task: task, p_countdown_ends_at: new Date(latest).toISOString() }))
    }
  }
  // Only a ready race starts: the database sets ready at the first bet, the first model entry or an admin start.
  // The room build takes about 15 s, so it starts before the countdown ends.
  const [due] = (await must(
    db.from('races').select('*').eq('status', 'open').eq('ready', true).order('countdown_ends_at').limit(1),
  )) as Race[]
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
