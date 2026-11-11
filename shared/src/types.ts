// Rows of the client-readable tables in supabase/migrations. Handwritten: update them with the schema.

export type Player = {
  id: string
  nickname: string
  credits: number // Oats balance
}

export type Horse = {
  id: string
  name: string
  model: string
  provider: string
  size_class: 'frontier' | 'small' | 'open-weight' | null
  reasoning_effort: string | null
  kind: 'house' | 'submitted'
  submitted_by: string | null
  active: boolean
  vision: boolean
}

export type Challenge = {
  id: string
  room: string
  lock: number
  category: 'text' | 'image' | 'puzzle' | 'robotics'
  public_blurb: string
}

export type Race = {
  id: number
  task: string
  status: 'open' | 'running' | 'settled'
  opens_at: string
  countdown_ends_at: string | null
  ready: boolean // a player is in the race or an admin started it; the runner starts only a ready race
  started_at: string | null
  betting_closed_at: string | null
  ended_at: string | null
  place_count: number
  winner_horse: string | null
  place_horses: string[] | null
  seed_revealed: string | null
}

export type Entry = {
  race_id: number
  horse_id: string
  sandbox_id: string | null
  // escaped = solved the challenge. out = stopped by live elimination, because it cost more than a finisher.
  state: 'waiting' | 'running' | 'escaped' | 'failed' | 'timeout' | 'out'
  progress: number // 0 to 100 from the progress function of the challenge, 100 = solved
  view: string | null // one line that shows the challenge state of this horse (cube stickers, rover map)
  locks_open: number
  locks: string | null
  steps: number
  last_step: string | null
  cost_usd: number
  tokens: number
  solved_ms: number | null
  last_lock_ms: number | null
  finish_pos: number | null
  diff: string | null
}

export type OddsSnapshot = {
  race_id: number
  at: string
  horse_id: string
  win_odds: number
}

export type Bet = {
  id: number
  race_id: number
  player_id: string | null // null = house seed
  market: 'win' | 'place'
  outcome: string // horse id
  amount: number
  created_at: string
  payout: number | null // null until the race is settled, 0 = lost
}
