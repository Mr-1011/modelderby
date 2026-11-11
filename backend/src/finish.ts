import type { Entry } from '@horserace/shared'

type Runner = Pick<Entry, 'horse_id' | 'state' | 'solved_ms' | 'locks_open' | 'last_lock_ms'>

// Escaped horses by time, then the others by open locks, then by the time of their latest lock.
// A failed horse never started, so it goes last. Returns the horse ids, first place first.
export function finishOrder(entries: Runner[]): string[] {
  const group = (e: Runner) => (e.state === 'escaped' ? 0 : e.state === 'failed' ? 2 : 1)
  const time = (ms: number | null) => ms ?? Number.MAX_SAFE_INTEGER
  return [...entries]
    .sort(
      (a, b) =>
        group(a) - group(b) ||
        time(a.solved_ms) - time(b.solved_ms) ||
        b.locks_open - a.locks_open ||
        time(a.last_lock_ms) - time(b.last_lock_ms),
    )
    .map((e) => e.horse_id)
}
