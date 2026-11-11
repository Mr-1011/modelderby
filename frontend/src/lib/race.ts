import type { Challenge, Entry, Horse, Race } from '@horserace/shared'
import { clock } from './format'

// What the board and the phone show of one race.
export type Lane = { horse: Horse; entry: Entry; win: number; place: number }
export type RaceView = { race: Race; lanes: Lane[]; challenges: Challenge[]; pool: number }

export const RACE_MS = 180_000

export const ROOMS: Record<string, string> = { vault: 'The Vault', lab: 'The Lab', archive: 'The Archive' }

// The status line of a race: the countdown, the race clock or the winner.
// A race that is not ready waits for its first player, so its countdown is not real.
export const statusOf = (race: Race, now: number, winner?: string) =>
  race.status === 'open'
    ? race.ready
      ? `Starts in ${clock(Date.parse(race.countdown_ends_at ?? race.opens_at) - now + 999)}`
      : 'Starts after a bet'
    : race.status === 'running'
      ? `${clock(now - Date.parse(race.started_at!))} / ${clock(RACE_MS)}`
      : winner
        ? `${winner} wins`
        : 'Race over'
