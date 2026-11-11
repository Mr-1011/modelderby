// Run from backend/: node --test src/finish.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Entry } from '@horserace/shared'
import { finishOrder } from './finish.ts'

const horse = (
  horse_id: string,
  state: Entry['state'],
  solved_ms: number | null,
  locks_open: number,
  last_lock_ms: number | null,
) => ({ horse_id, state, solved_ms, locks_open, last_lock_ms })

test('escaped by time, then open locks, then latest lock, failed last', () => {
  const order = finishOrder([
    horse('failed', 'failed', null, 0, null),
    horse('two-late', 'timeout', null, 2, 90_000),
    horse('no-locks', 'timeout', null, 0, null),
    horse('slow-escape', 'escaped', 150_000, 5, 150_000),
    horse('three', 'timeout', null, 3, 170_000),
    horse('two-early', 'timeout', null, 2, 40_000),
    horse('fast-escape', 'escaped', 80_000, 5, 80_000),
  ])
  assert.deepEqual(order, ['fast-escape', 'slow-escape', 'three', 'two-early', 'two-late', 'no-locks', 'failed'])
})
