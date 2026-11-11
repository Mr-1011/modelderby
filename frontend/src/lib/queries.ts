import {
  type Bet,
  type Challenge,
  type Entry,
  type Horse,
  type Player,
  type Race,
  type RaceEvent,
  type Stakes,
  placeOdds,
  winOdds,
} from '@horserace/shared'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { RaceView } from './race'
import { supabase } from './supabase'

// All Supabase access of the frontend goes through this file.

// One shared value: a new component has the session in its first render, so a page does not flash its signed-out state.
let session: Session | null | undefined
const sessionListeners = new Set<() => void>()
supabase.auth.onAuthStateChange((_event, next) => {
  session = next
  sessionListeners.forEach((listener) => listener())
})

// undefined means the session is still loading. null means signed out.
export function useSession() {
  return useSyncExternalStore(
    (listener) => {
      sessionListeners.add(listener)
      return () => sessionListeners.delete(listener)
    },
    () => session,
  )
}

export const signOut = () => supabase.auth.signOut({ scope: 'local' })

// A query function must throw, so that TanStack Query sees the error.
async function get<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as T
}

export function useNow() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])
  return now
}

// The signed-in player. A payout arrives when the runner settles a race, so the balance reloads on a timer.
export function usePlayer() {
  const id = useSession()?.user.id
  return useQuery({
    queryKey: ['player', id],
    enabled: !!id,
    refetchInterval: 10_000,
    queryFn: () => get<Player>(supabase.from('players').select('*').eq('id', id!).single()),
  })
}

// A player sets the public name and the rider on the profile page.
export async function setProfile(nickname: string, rider: number[]) {
  const { error } = await supabase.rpc('set_profile', { p_nickname: nickname, p_rider: rider })
  if (error) throw new Error(error.message)
}

export type Standing = Player & { invested: number }

// The 10 players with the most Credits. invested is the Credits of a player in bets on races that are not settled.
export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    refetchInterval: 10_000,
    queryFn: async (): Promise<Standing[]> => {
      const players = await get<Player[]>(
        supabase.from('players').select('*').order('credits', { ascending: false }).limit(10),
      )
      // shortcut: PostgREST returns at most 1000 rows, so invested is too low if these 10 players have more than
      // 1000 open bets. Sum in a view if that happens.
      const open = await get<Pick<Bet, 'player_id' | 'amount'>[]>(
        supabase.from('bets').select('player_id, amount').is('payout', null).in('player_id', players.map((player) => player.id)),
      )
      return players.map((player) => ({
        ...player,
        invested: open.filter((bet) => bet.player_id === player.id).reduce((sum, bet) => sum + bet.amount, 0),
      }))
    },
  })
}

type BetTotal = { race_id: number; market: string; outcome: string; staked: number; player_staked: number }

const stakesOf = (totals: BetTotal[], market: string): Stakes =>
  Object.fromEntries(totals.filter((total) => total.market === market).map((total) => [total.outcome, total.staked]))

// The Credits of players in both markets. The house seed does not count.
const poolOf = (totals: BetTotal[]) => totals.reduce((sum, total) => sum + total.player_staked, 0)

export type RaceSummary = { race: Race; horses: Horse[]; pool: number; favorite?: Horse; favoriteOdds: number }

// The newest 30 races with their lineup, pool and favorite, for the race list.
export function useRaces() {
  return useQuery({
    queryKey: ['races'],
    refetchInterval: 5000,
    queryFn: async (): Promise<RaceSummary[]> => {
      const races = await get<(Race & { entries: { horse: Horse }[] })[]>(
        supabase.from('races').select('*, entries(horse:horses(*))').order('id', { ascending: false }).limit(30),
      )
      const totals = await get<BetTotal[]>(
        supabase.from('bet_totals').select('*').in('race_id', races.map((race) => race.id)),
      )
      return races.map(({ entries, ...race }) => {
        const horses = entries.map((entry) => entry.horse).sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
        const mine = totals.filter((total) => total.race_id === race.id)
        const win = stakesOf(mine, 'win')
        const favorite = horses.slice().sort((a, b) => (win[b.id] ?? 0) - (win[a.id] ?? 0))[0]
        return {
          race,
          horses,
          pool: poolOf(mine),
          favorite,
          favoriteOdds: favorite && win[favorite.id] ? winOdds(win, favorite.id) : 0,
        }
      })
    },
  })
}

// The race for the big screen: the race that runs, else the next open race, else the newest race.
export function useBoardRaceId() {
  const { data } = useRaces()
  if (!data) return undefined
  const running = data.find(({ race }) => race.status === 'running')
  const open = data.filter(({ race }) => race.status === 'open').at(-1)
  return (running ?? open ?? data[0])?.race.id
}

const ENTRY_COLUMNS =
  'race_id, horse_id, sandbox_id, state, progress, view, locks_open, locks, steps, last_step, cost_usd, tokens, solved_ms, last_lock_ms, finish_pos'

export type LiveRace = RaceView & { bets: Bet[]; win: Stakes; place: Stakes }

// One race, live. It is a RaceView, so the board and the phone view can render it.
export function useRace(id: number | undefined) {
  const client = useQueryClient()

  useEffect(() => {
    if (!id) return
    // A race sends many events per second. One reload per 300 ms covers them all.
    let timer: ReturnType<typeof setTimeout> | undefined
    const reload = () => {
      timer ??= setTimeout(() => {
        timer = undefined
        client.invalidateQueries({ queryKey: ['race', id] })
      }, 300)
    }
    // The name is new for each caller. Two callers with the same name get the same channel, and the second `on` then throws.
    const channel = supabase
      .channel(`race-${id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'races', filter: `id=eq.${id}` }, () => {
        reload()
        // The settle pays the players, so the balance is new too.
        client.invalidateQueries({ queryKey: ['player'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter: `race_id=eq.${id}` }, reload)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bets', filter: `race_id=eq.${id}` }, reload)
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [id, client])

  return useQuery({
    queryKey: ['race', id],
    enabled: !!id,
    // A fallback for a lost Realtime connection.
    refetchInterval: 10_000,
    queryFn: async (): Promise<LiveRace> => {
      // One round of requests, so a bet shows fast on a slow network.
      const [race, rows, totals, bets, challenges] = await Promise.all([
        get<Race>(supabase.from('races').select('*').eq('id', id!).single()),
        // Without the diff column: it is large, and this query runs many times in a race.
        get<(Omit<Entry, 'diff'> & { horse: Horse })[]>(
          supabase.from('entries').select(`${ENTRY_COLUMNS}, horse:horses(*)`).eq('race_id', id!),
        ),
        get<BetTotal[]>(supabase.from('bet_totals').select('*').eq('race_id', id!)),
        // shortcut: PostgREST returns at most 1000 rows, so the chart and "your bets" miss later bets of a
        // race with more than 1000 bets. The odds and the pool come from bet_totals and stay exact. Page this
        // query if a race gets that many bets.
        get<Bet[]>(supabase.from('bets').select('*').eq('race_id', id!).order('created_at')),
        get<Challenge[]>(supabase.from('challenges').select('*').order('lock')),
      ])
      const win = stakesOf(totals, 'win')
      const place = stakesOf(totals, 'place')
      const lanes = rows
        .map(({ horse, ...entry }) => ({
          horse,
          entry: { ...entry, diff: null },
          win: win[horse.id] ? winOdds(win, horse.id) : 0,
          place: place[horse.id] ? placeOdds(place, horse.id, rows.length, race.place_count) : 0,
        }))
        // The finish order after the race. Before it: the house horses, then the models of players.
        .sort(
          (a, b) =>
            (a.entry.finish_pos ?? 99) - (b.entry.finish_pos ?? 99) ||
            a.horse.kind.localeCompare(b.horse.kind) ||
            a.horse.id.localeCompare(b.horse.id),
        )
      return {
        race,
        lanes,
        challenges: challenges.filter((challenge) => challenge.room === race.task),
        pool: poolOf(totals),
        bets,
        win,
        place,
      }
    },
  })
}

export async function placeBet(race: number, market: 'win' | 'place', horse: string, amount: number) {
  const { error } = await supabase.rpc('place_bet', { p_race: race, p_market: market, p_outcome: horse, p_amount: amount })
  if (error) throw new Error(error.message)
}

// An admin starts an open race in 20 seconds. The database rejects a player who is not an admin.
export async function startRace(race: number) {
  const { error } = await supabase.rpc('start_race', { p_race: race })
  if (error) throw new Error(error.message)
}

export function useIsAdmin() {
  const id = useSession()?.user.id
  return useQuery({
    queryKey: ['admin', id],
    queryFn: async () => !!id && (await get<boolean>(supabase.rpc('is_admin'))),
  })
}

// What the runner did, newest first, for the ops view. Only an admin gets rows.
export function useRaceEvents(enabled: boolean) {
  const client = useQueryClient()
  return useQuery({
    queryKey: ['events'],
    enabled,
    // shortcut: a poll, not Realtime, because the row filter of this table is a function call for each row.
    // Add the table to the Realtime publication if one second is too slow.
    refetchInterval: 1000,
    queryFn: async (): Promise<RaceEvent[]> => {
      // Only the rows after the newest known row, so each poll is small.
      const known = client.getQueryData<RaceEvent[]>(['events']) ?? []
      const fresh = await get<RaceEvent[]>(
        supabase.from('race_events').select('*').gt('id', known[0]?.id ?? 0).order('id', { ascending: false }).limit(1000),
      )
      return [...fresh, ...known].slice(0, 3000)
    },
  })
}

// The number of sandboxes that the runner forked since midnight, local time.
export function useForksToday(enabled: boolean) {
  return useQuery({
    queryKey: ['forks-today'],
    enabled,
    refetchInterval: 5000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('race_events')
        .select('id', { count: 'exact', head: true })
        .eq('kind', 'fork_created')
        .gte('at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      if (error) throw new Error(error.message)
      return count ?? 0
    },
  })
}

export async function enterModel(race: number, model: string, name: string) {
  const { error } = await supabase.rpc('enter_model', { p_race: race, p_model: model, p_name: name })
  if (error) throw new Error(error.message)
}

export type Model = { id: string; name: string; prompt: number; completion: number }

// The runner checks the same limits before a race: tool calls, and a price limit in USD per million tokens.
const MAX_PROMPT_USD = 5
const MAX_COMPLETION_USD = 25

// The models of OpenRouter that a player can enter. The list is public and needs no key.
export function useModels() {
  return useQuery({
    queryKey: ['models'],
    staleTime: Infinity,
    queryFn: async (): Promise<Model[]> => {
      const response = await fetch('https://openrouter.ai/api/v1/models')
      if (!response.ok) throw new Error('The model list of OpenRouter did not load')
      const { data } = (await response.json()) as {
        data: { id: string; name: string; supported_parameters?: string[]; pricing?: { prompt?: string; completion?: string } }[]
      }
      return data
        .map((model) => ({
          id: model.id,
          name: model.name,
          tools: model.supported_parameters?.includes('tools'),
          prompt: Number(model.pricing?.prompt) * 1e6,
          completion: Number(model.pricing?.completion) * 1e6,
        }))
        .filter(
          (model) =>
            model.tools &&
            !model.id.includes(':') &&
            // A router model has the price -1, because its price is not fixed.
            model.prompt >= 0 &&
            model.completion >= 0 &&
            model.prompt <= MAX_PROMPT_USD &&
            model.completion <= MAX_COMPLETION_USD,
        )
    },
  })
}
