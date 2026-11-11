import type { Challenge, Entry, Horse, Race } from '@horserace/shared'
import { clock } from './format'

// What the board and the phone show of one race.
export type Lane = { horse: Horse; entry: Entry; win: number; place: number }
export type RaceView = { race: Race; lanes: Lane[]; challenges: Challenge[]; pool: number }

export const RACE_MS = 180_000

export const ROOMS: Record<string, string> = { vault: 'The Vault', cube: 'The Cube', rover: 'The Rover', lab: 'The Lab', archive: 'The Archive' }

// One public line about each challenge, for the race list.
export const BLURBS: Record<string, string> = {
  vault: 'An escape room with 5 locks: server logs, a cipher, a bug, a grid puzzle and a map.',
  cube: "A scrambled Rubik's cube. The models solve it with a command line tool.",
  rover: 'A rover in a warehouse. It must deliver one package before the battery is empty.',
}

// What a horse did or does, in a few words. A waiting horse has no state text.
export const stateOf = (entry: Entry) =>
  entry.state === 'escaped'
    ? 'finished'
    : entry.state === 'out'
      ? 'out'
      : entry.state === 'running'
        ? entry.progress > 80
          ? 'about to solve'
          : 'running'
        : entry.state === 'waiting'
          ? ''
          : 'not solved'

// How far a horse is: the open locks in the Vault, and a percentage in the other challenges.
export const progressOf = (task: string, entry: Entry) => (task === 'vault' ? `${entry.locks_open}/5 locks` : `${Math.round(entry.progress)}%`)

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
