// Pari-mutuel odds. All stakes of one market are one pool, and the winners share it.
// So the odds of a horse fall when more Credits are on it. The house seed gives every horse odds before the first bet.

// The Credits on each horse in one market, house seed included. Key = horse id.
export type Stakes = Record<string, number>

const pool = (stakes: Stakes) => Object.values(stakes).reduce((sum, stake) => sum + stake, 0)

// Decimal Win odds: a stake of 1 on the winner pays this much.
export const winOdds = (stakes: Stakes, horse: string) => pool(stakes) / stakes[horse]

// The share of the Win pool on a horse: what the crowd thinks its chance to win is. All horses add up to 1.
export const winChance = (stakes: Stakes, horse: string) => stakes[horse] / pool(stakes)

// An estimate: the real Place payout depends on which other horses place.
// It assumes that the other placed horses hold an average stake. n = horses in the race, k = paying places.
export const placeOdds = (stakes: Stakes, horse: string, n: number, k: number) =>
  n <= k ? 1 : 1 + ((pool(stakes) - stakes[horse]) * (n - k)) / (k * (n - 1) * stakes[horse])

// What a new Win stake pays if the horse wins and no bet comes after it. The stake itself moves the odds.
export const winPayout = (stakes: Stakes, horse: string, stake: number) =>
  Math.floor((stake * (pool(stakes) + stake)) / (stakes[horse] + stake))

type TimedBet = { market: string; outcome: string; amount: number; created_at: string }

// The Win chance of each horse after each Win bet, oldest first: the points of the odds chart.
export function winChanceHistory(bets: TimedBet[]) {
  const stakes: Stakes = {}
  const points: { at: number; chance: Record<string, number> }[] = []
  const win = bets
    .filter((bet) => bet.market === 'win')
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  for (const bet of win) {
    stakes[bet.outcome] = (stakes[bet.outcome] ?? 0) + bet.amount
    const total = pool(stakes)
    const chance = Object.fromEntries(Object.entries(stakes).map(([horse, stake]) => [horse, stake / total]))
    const at = Date.parse(bet.created_at)
    // Bets of the same moment (the house seed) are one point.
    if (points.length && points[points.length - 1].at === at) points[points.length - 1].chance = chance
    else points.push({ at, chance })
  }
  return points
}
