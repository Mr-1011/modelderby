// Run from the repo root: node --test shared/src/finish.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { finishOrder } from './finish.ts'
import type { Entry } from './types.ts'

const horse = (horse_id: string, state: Entry['state'], cost_usd: number, progress: number) => ({
  horse_id,
  state,
  cost_usd,
  progress,
})

test('finishers by cost, then progress, then cost, failed last', () => {
  const order = finishOrder([
    horse('failed', 'failed', 0, 0),
    horse('half-dear', 'timeout', 0.09, 50),
    horse('nothing', 'timeout', 0.01, 0),
    horse('dear-finish', 'escaped', 0.2, 100),
    horse('out', 'out', 0.3, 80),
    horse('half-cheap', 'timeout', 0.02, 50),
    horse('cheap-finish', 'escaped', 0.05, 100),
  ])
  assert.deepEqual(order, ['cheap-finish', 'dear-finish', 'out', 'half-cheap', 'half-dear', 'nothing', 'failed'])
})
