import type { Challenge, Entry, Horse, Race } from '@horserace/shared'

// What the board and the phone show of one race.
export type Lane = { horse: Horse; entry: Entry; win: number; place: number }
export type RaceView = { race: Race; lanes: Lane[]; challenges: Challenge[]; pool: number }

export const RACE_MS = 180_000

export const ROOMS: Record<string, string> = { vault: 'The Vault', lab: 'The Lab', archive: 'The Archive' }
