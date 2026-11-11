// Room blueprints live on the Archil disk "derby" (rooms/<room>/). The runner builds every race room from there.
// Run from backend/ to push a room from the private pool and test it in a sandbox:
//   node --env-file=.env src/prepare.ts vault
import { readFile } from 'node:fs/promises'
import * as archil from 'disk'

let derby: Promise<archil.Disk> | undefined

export function disk() {
  return (derby ??= (async () => {
    const found = (await archil.listDisks()).find((d) => d.name === 'derby')
    return found ?? (await archil.createDisk({ name: 'derby' })).disk
  })())
}

// Builds the room of one race in a new sandbox and stops it, so each horse can get a fork of it.
// Returns the checker of this seed. The generator and the seed do not stay in the sandbox.
export async function buildBase(name: string, room: string, seed: string) {
  const d = await disk()
  const text = async (file: string) => new TextDecoder().decode(await d.getObject(`rooms/${room}/${file}`))
  const base = await archil.createSandbox({ name, baseImage: 'python:3.13', vcpuCount: 1, memSizeMiB: 2048 })
  const setup = await base.exec(
    'mkdir -p /opt/room-src && cd /opt/room-src && printf %s "$SETUP" > setup.py && printf %s "$CHECK" > check.sh' +
      ` && python3 setup.py --seed ${seed} >&2 && rm -rf /opt/room-src && cat /room/check.sh`,
    { env: { SETUP: await text('setup.py'), CHECK: await text('check.sh') }, timeoutSeconds: 120 },
  )
  if (setup.exitCode !== 0) {
    await remove(base)
    throw new Error(`room setup failed: ${setup.stderr.slice(-500)}`)
  }
  await base.stop()
  return { base, check: setup.stdout }
}

// The runner's own copy of the checker. Returns one character per lock, for example "11000".
export async function runCheck(sandbox: archil.Sandbox, check: string) {
  const result = await sandbox.exec('bash -c "$CHECK"', { env: { CHECK: check, ROOM: '/room' }, timeoutSeconds: 30 })
  return [1, 2, 3, 4, 5].map((n) => (result.stdout.includes(`lock${n} open`) ? '1' : '0')).join('')
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

  // The gate: a fresh room has 0 locks open, and the reference solution opens all 5.
  const { base, check } = await buildBase(`derby-rtest-${room}-base`, room, 'test')
  const fork = await base.fork({ name: `derby-rtest-${room}-fork` })
  console.log('fresh room:', await runCheck(fork, check))
  const solve = await fork.exec('python3 -c "$SOLVE"', {
    env: { SOLVE: new TextDecoder().decode(await d.getObject(`rooms/${room}/solve.py`)) },
    timeoutSeconds: 120,
  })
  console.log('after solve.py:', await runCheck(fork, check), solve.exitCode === 0 ? '' : solve.stderr)
  await remove(fork)
  await remove(base)
}
