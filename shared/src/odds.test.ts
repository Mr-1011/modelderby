// Run: node --test shared/src/odds.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { placeOdds, winChance, winChanceHistory, winOdds, winPayout } from './odds.ts'

// The house seed of a race: 2,000 Credits, more on the strong horses.
const seed = { h1: 500, h2: 500, h3: 400, h4: 300, h5: 200, h6: 100 }

test('a strong horse starts with lower odds', () => {
  assert.equal(winOdds(seed, 'h1'), 4)
  assert.equal(winOdds(seed, 'h6'), 20)
  assert.equal(winChance(seed, 'h1'), 0.25)
})

test('a bet on a horse lowers its odds and raises the others', () => {
  const after = { ...seed, h6: 600 }
  assert.ok(winOdds(after, 'h6') < winOdds(seed, 'h6'))
  assert.ok(winOdds(after, 'h1') > winOdds(seed, 'h1'))
})

test('the payout counts the new stake in the pool: same number as settle_race', () => {
  // test_bets.sql: 400 on h1 in a pool that is 2,900 after the bet, with 900 on h1, pays 1288.
  assert.equal(winPayout({ ...seed, h2: 800, colt: 200 }, 'h1', 400), 1288)
})

test('place odds: the example of the brief', () => {
  const even = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`h${i}`, 250]))
  assert.equal(winOdds(even, 'h0'), 8)
  assert.ok(Math.abs(placeOdds(even, 'h0', 8, 3) - 2.667) < 0.001)
})

test('the chart has one point for the seed and one per later bet', () => {
  const at = '2026-11-10T20:00:00Z'
  const points = winChanceHistory([
    { market: 'win', outcome: 'h1', amount: 500, created_at: at },
    { market: 'win', outcome: 'h2', amount: 500, created_at: at },
    { market: 'place', outcome: 'h1', amount: 999, created_at: at },
    { market: 'win', outcome: 'h2', amount: 1000, created_at: '2026-11-10T20:01:00Z' },
  ])
  assert.equal(points.length, 2)
  assert.deepEqual(points[0].chance, { h1: 0.5, h2: 0.5 })
  assert.deepEqual(points[1].chance, { h1: 0.25, h2: 0.75 })
})
