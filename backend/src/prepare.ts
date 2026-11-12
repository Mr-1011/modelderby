// Room blueprints live on the Archil disk "derby" (rooms/<room>/). The runner builds every race room from there.
// Run from backend/ to push a room from the private pool and test it in a sandbox:
//   node --env-file=.env src/prepare.ts vault
import { readFile } from 'node:fs/promises'
import * as archil from 'disk'
import { ROOMS } from '@modelderby/shared'

let derby: Promise<archil.Disk> | undefined

export function disk() {
  return (derby ??= (async () => {
    const found = (await archil.listDisks()).find((d) => d.name === 'derby')
    return found ?? (await archil.createDisk({ name: 'derby' })).disk
  })())
}

// A room has no network. Only a room with the command `search` reaches one host, the search service.
// Archil adds the key to each request outside the sandbox, so the key is never in a room. A fork keeps these rules.
const network = (room: string) => ({
  egress: {
    default: 'deny' as const,
    allow: ROOMS[room]?.search
      ? [{ target: 'api.keenable.ai', transform: { headers: { 'X-API-Key': process.env.KEENABLE_API_KEY! } } }]
      : [],
  },
})

// Builds the room of one race in a new sandbox and stops it, so each horse can get a fork of it.
// Returns the checker of this seed. The generator and the seed do not stay in the sandbox.
// The checker is /room/check.sh. A room whose checker holds data that a horse must not see writes the real one
// as runner-check.sh next to setup.py: that file goes only to the runner, and /room/check.sh is a public version.
// Each room becomes a git repository, so the final diff of a horse works for every room.
// The level (1 easy to 3 hard) sets the size of the job, see shared/src/rooms.ts.
export async function buildBase(name: string, room: string, seed: string, level = 1) {
  const d = await disk()
  const text = async (file: string) => new TextDecoder().decode(await d.getObject(`rooms/${room}/${file}`))
  const base = await archil.createSandbox({ name, baseImage: 'python:3.13', vcpuCount: 1, memSizeMiB: 2048, network: network(room) })
  const setup = await base.exec(
    'mkdir -p /opt/room-src && cd /opt/room-src && printf %s "$SETUP" > setup.py && printf %s "$CHECK" > check.sh' +
      ` && python3 setup.py --seed ${seed} --level ${level} >&2 && (cat runner-check.sh 2>/dev/null || cat /room/check.sh)` +
      ' && cd /room && rm -rf /opt/room-src && { [ -d .git ] || { git init -q && git add -A &&' +
      ' git -c user.name=room -c user.email=room@example.com commit -qm room; }; } >&2',
    { env: { SETUP: await text('setup.py'), CHECK: await text('check.sh') }, timeoutSeconds: 120 },
  )
  if (setup.exitCode !== 0) {
    await remove(base)
    throw new Error(`room setup failed: ${setup.stderr.slice(-500)}`)
  }
  await base.stop()
  return { base, check: setup.stdout }
}

// The runner's own copy of the checker. A room checker prints "PROGRESS <0 to 100>" and optionally "VIEW <one line>".
// The vault checker prints one line per lock instead, and each open lock is 20 points. Returns fields of an entry.
export async function runCheck(sandbox: archil.Sandbox, check: string) {
  // shortcut: the checker runs in the sandbox of the horse, where the horse is root. So a horse can read the checker
  // text in /proc/<pid>/environ for the time of one check, and it can replace bash or python3 to print any progress.
  // Run the checker in a fresh fork of the base that gets only the files of /room before a race is for more than
  // play money.
  const { stdout } = await sandbox.exec('bash -c "$CHECK"', { env: { CHECK: check, ROOM: '/room' }, timeoutSeconds: 30 })
  const progress = stdout.match(/^PROGRESS (\d+)/m)?.[1]
  if (progress) {
    return { progress: Number(progress), view: stdout.match(/^VIEW (.*)/m)?.[1] ?? null, locks: null, locks_open: 0 }
  }
  if (!stdout.includes('lock1 ')) throw new Error('the checker gave no result')
  const locks = [1, 2, 3, 4, 5].map((n) => (stdout.includes(`lock${n} open`) ? '1' : '0')).join('')
  const open = locks.split('1').length - 1
  return { progress: open * 20, view: null, locks, locks_open: open }
}

export async function remove(sandbox: archil.Sandbox) {
  await sandbox.stop().catch(() => {})
  await sandbox.delete()
}

// Removes the sandboxes that a crashed race left behind. A base cannot go before its forks.
export async function removeLeftovers() {
  const left = (await archil.listSandboxes()).filter((s) => s.name.startsWith('derby-r'))
  const isBase = (s: archil.Sandbox) => s.name.endsWith('-base')
  await Promise.allSettled(left.filter((s) => !isBase(s)).map(remove))
  await Promise.allSettled(left.filter(isBase).map(remove))
}

if (import.meta.main) {
  const room = process.argv[2]
  const d = await disk()
  for (const file of ['setup.py', 'check.sh', 'solve.py']) {
    await d.putObject(`rooms/${room}/${file}`, await readFile(new URL(`../../pool/${room}/${file}`, import.meta.url)))
  }
  console.log(`pushed pool/${room} to the disk ${d.name}`)

  // The gate, for each level: the progress of a fresh room is below 100, and the reference solution brings it to 100.
  // These names do not start with "derby-r", so a runner that starts at the same time leaves them alone.
  const solveText = new TextDecoder().decode(await d.getObject(`rooms/${room}/solve.py`))
  await Promise.all(
    [1, 2, 3].map(async (level) => {
      const { base, check } = await buildBase(`derby-gate-${room}-${level}-base`, room, 'test', level)
      const fork = await base.fork({ name: `derby-gate-${room}-${level}-fork` })
      const fresh = await runCheck(fork, check)
      const solve = await fork.exec('python3 -c "$SOLVE"', { env: { SOLVE: solveText }, timeoutSeconds: 120 })
      const solved = await runCheck(fork, check)
      console.log(`level ${level}: fresh room:`, fresh, 'after solve.py:', solved, solve.exitCode === 0 ? '' : solve.stderr)
      if (fresh.progress >= 100 || solved.progress !== 100) process.exitCode = 1
      await remove(fork)
      await remove(base)
    }).map((gate, i) =>
      gate.catch((error) => {
        console.error(`level ${i + 1}:`, error)
        process.exitCode = 1
      }),
    ),
  )
}
