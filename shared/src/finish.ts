import type { Entry } from './types.ts'

type Runner = Pick<Entry, 'horse_id' | 'state' | 'cost_usd' | 'progress'>

// The cheapest finisher wins. Then the horses that did not finish: the highest progress first, and the cheaper
// horse first on equal progress. A failed horse never started, so it goes last.
// Returns the horse ids, first place first. During a race this is the live standing.
export function finishOrder(entries: Runner[]): string[] {
  const group = (e: Runner) => (e.state === 'escaped' ? 0 : e.state === 'failed' ? 2 : 1)
  return [...entries]
    .sort((a, b) => group(a) - group(b) || b.progress - a.progress || a.cost_usd - b.cost_usd)
    .map((e) => e.horse_id)
}
