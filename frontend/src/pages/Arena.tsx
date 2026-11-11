import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GoogleButton from '../components/GoogleButton'
import RaceCard from '../components/RaceCard'
import { enterModel, type Model, useModels, useNow, useRaces, useSession } from '../lib/queries'

// The models that we suggest, so a player can enter fast. The list shows only the ones that OpenRouter has.
const SUGGESTED = [
  'anthropic/claude-haiku-5.5',
  'mistralai/mistral-large-4-0',
  'z-ai/glm-5.3',
  'moonshotai/kimi-k3.1-pro',
  'minimax/minimax-m3.1-flash',
  'qwen/qwen3.8-max-0902',
  'google/gemini-3.5-flash-lite',
  'x-ai/grok-4.5',
]
const MAX_HORSES = 8

const FIELD = 'h-12 w-full border-2 border-text bg-bg px-3 text-[16px] placeholder:text-muted'
const OPTION = 'block w-full truncate border-b-2 border-line py-3 text-left text-[14px] aria-pressed:text-accent'

function EntryForm({ race, models }: { race: number; models: Model[] }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [model, setModel] = useState<Model>()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  const options = words.length
    ? models.filter((option) => words.every((word) => `${option.id} ${option.name}`.toLowerCase().includes(word))).slice(0, 8)
    : models.filter((option) => SUGGESTED.includes(option.id))

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        setBusy(true)
        enterModel(race, model!.id, name.trim()).then(
          () => navigate(`/race/${race}`),
          (failure: Error) => {
            setError(failure.message)
            setBusy(false)
          },
        )
      }}
    >
      <input
        aria-label="Search a model on OpenRouter"
        placeholder="Search a model on OpenRouter"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className={FIELD}
      />
      <ul>
        {options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              aria-pressed={model?.id === option.id}
              onClick={() => {
                setModel(option)
                // "Anthropic: Claude Haiku 5.5" -> "Claude Haiku 5.5"
                setName(option.name.split(': ').at(-1)!.slice(0, 24))
              }}
              className={OPTION}
            >
              {option.id}
            </button>
          </li>
        ))}
      </ul>
      {words.length > 0 && options.length === 0 && <p className="py-3 text-[14px] text-muted">No model with tool calls matches.</p>}
      {model && (
        <>
          <input
            aria-label="Horse name"
            placeholder="Horse name"
            value={name}
            minLength={2}
            maxLength={24}
            required
            onChange={(event) => setName(event.target.value)}
            className={`${FIELD} mt-4`}
          />
          <button
            disabled={busy}
            className="mt-3 h-14 w-full bg-accent font-pixel text-[30px] leading-none text-on-accent disabled:bg-line disabled:text-muted"
          >
            Enter the race
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[14px]">
          {error}
        </p>
      )}
    </form>
  )
}

// The open races. A player can enter one OpenRouter model per race, and it runs on our key.
export default function Arena() {
  const session = useSession()
  const { data, error } = useRaces()
  const { data: models } = useModels()
  const now = useNow()
  const [entering, setEntering] = useState<number>()
  // A race that is not ready waits for its first player, so its countdown does not close the entries.
  const open = data
    ?.filter(
      ({ race }) => race.status === 'open' && (!race.ready || Date.parse(race.countdown_ends_at ?? race.opens_at) > now),
    )
    .reverse()
  return (
    <main>
      <p className="mt-6 max-w-2xl text-[15px] leading-relaxed">
        Enter a model in an open race. It runs the same escape room as the house horses, and everyone can bet on it.
      </p>
      {error && <p className="mt-6">{error.message}</p>}
      {open?.length === 0 && <p className="mt-6 text-muted">No open race now. The next race opens soon.</p>}
      <ul className="mt-4 grid items-start gap-4 lg:grid-cols-2">
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
                <GoogleButton long />
              ) : entering === race.id && models ? (
                <EntryForm race={race.id} models={models} />
              ) : (
                <button
                  onClick={() => setEntering(race.id)}
                  className="h-12 w-full border-2 border-text px-4 font-pixel text-[24px] leading-none"
                >
                  Enter a model, {horses.length} of {MAX_HORSES} horses
                </button>
              )}
            </RaceCard>
          )
        })}
      </ul>
    </main>
  )
}
