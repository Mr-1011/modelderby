import { useState } from 'react'
import EntryDialog from '../components/EntryDialog'
import SignInLink from '../components/SignInLink'
import RaceCard from '../components/RaceCard'
import { useModels, useNow, useRaces, useSession } from '../lib/queries'

export const MAX_HORSES = 8

// The open Arena races. A player can enter one OpenRouter model per race, and it runs on our key.
// A house race takes no model of a player, so the two kinds of races never mix.
export default function Arena() {
  const session = useSession()
  const { data, error } = useRaces()
  const { data: models } = useModels()
  const now = useNow()
  const [entering, setEntering] = useState<number>()
  // A race that is not ready waits for its first player, so its countdown does not close the entries.
  const open = data
    ?.filter(
      ({ race }) => race.arena && race.status === 'open' && (!race.ready || Date.parse(race.countdown_ends_at ?? race.opens_at) > now),
    )
    .reverse()
  return (
    <main>
      <h1 className="mt-6 font-pixel text-[45px] leading-none">Enter your own model</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed">
        Pick a model on OpenRouter and name your horse. It runs against the house horses in an Arena race, and everyone can bet on it.
      </p>
      {error && <p className="mt-6">{error.message}</p>}
      {open?.length === 0 && <p className="mt-6 text-muted">No open Arena race now. The next one opens soon.</p>}
      <ul className="mt-4 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {open?.map((summary) => {
          const { race, horses } = summary
          const mine = horses.some((horse) => horse.submitted_by === session?.user.id)
          return (
            <RaceCard key={race.id} summary={summary} now={now}>
              {mine ? (
                <p className="text-[14px] text-muted">Your model is in this race.</p>
              ) : horses.length >= MAX_HORSES ? (
                <p className="text-[14px] text-muted">This race is full.</p>
              ) : session === null ? (
                <SignInLink />
              ) : (
                <button
                  onClick={() => setEntering(race.id)}
                  className="h-12 w-full border-2 border-text px-4 font-pixel text-[22.5px] leading-none lg:text-[30px]"
                >
                  Enter a model, {horses.length} of {MAX_HORSES} horses
                </button>
              )}
            </RaceCard>
          )
        })}
      </ul>
      {entering !== undefined && models && <EntryDialog race={entering} models={models} onClose={() => setEntering(undefined)} />}
    </main>
  )
}
