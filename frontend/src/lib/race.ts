import { ROOMS as ALL } from '@modelderby/shared'
import type { Challenge, Entry, Horse, Race } from '@modelderby/shared'
import { clock } from './format'

// What the board and the phone show of one race.
export type Lane = { horse: Horse; entry: Entry; win: number; place: number }
export type RaceView = { race: Race; lanes: Lane[]; challenges: Challenge[]; pool: number }

export const RACE_MS = 180_000

// The title of each challenge, from the one list in shared/src/rooms.ts. blurbOf in shared gives its public line.
export const ROOMS: Record<string, string> = Object.fromEntries(Object.entries(ALL).map(([room, { title }]) => [room, title]))
// The tags of each challenge: the tools that a horse has in the room besides the shell. The category is only for us.
export const TAGS: Record<string, string[]> = Object.fromEntries(
  Object.entries(ALL).map(([room, { search }]) => [room, search ? ['Keenable web search'] : []]),
)
// The icon of an external tool, for its tag: the favicon of the service, in frontend/public.
export const TAG_ICONS: Record<string, string> = { 'Keenable web search': '/keenable.png' }

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
      : '10 min after first bet'
    : race.status === 'running'
      ? `${clock(now - Date.parse(race.started_at!))} / ${clock(RACE_MS)}`
      : winner
        ? `${winner} wins`
        : 'Race over'
