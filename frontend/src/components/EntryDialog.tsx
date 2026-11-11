import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usd } from '../lib/format'
import { enterModel, type Model } from '../lib/queries'

// The models that we suggest, so a player can enter fast. They are on top of the list when OpenRouter has them.
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
// The list shows this many models. A search or a filter makes it shorter.
const ROWS = 100

const FIELD = 'h-12 w-full min-w-0 border-2 border-text bg-bg px-3 text-[16px] placeholder:text-muted disabled:border-line'
const FILTER =
  'h-9 border-2 border-line px-3 text-[13px] hover:border-accent hover:text-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent'

// "anthropic/claude-haiku-5.5" -> "anthropic"
const makerOf = (model: Model) => model.id.split('/')[0]
// "Anthropic: Claude Haiku 5.5" -> "Claude Haiku 5.5"
const shortName = (model: Model) => model.name.split(': ').at(-1)!

// The pop-up to add a horse to an open race: a search over the models of OpenRouter with filters,
// then the name of the new horse. The race page and the Arena both open it.
export default function EntryDialog({ race, models, onClose }: { race: number; models: Model[]; onClose: () => void }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [maker, setMaker] = useState<string>()
  const [cheapest, setCheapest] = useState(false)
  const [model, setModel] = useState<Model>()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // The 5 makers with the most models are the filters. The label is the name that OpenRouter gives the maker.
  const count = new Map<string, number>()
  for (const option of models) count.set(makerOf(option), (count.get(makerOf(option)) ?? 0) + 1)
  const makers = [...count].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const label = (key: string) =>
    models.find((option) => makerOf(option) === key && option.name.includes(': '))?.name.split(': ')[0] ?? key

  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  const cost = (option: Model) => option.prompt + option.completion
  const found = models
    .filter(
      (option) =>
        (!maker || makerOf(option) === maker) && words.every((word) => `${option.id} ${option.name}`.toLowerCase().includes(word)),
    )
    // The sort keeps the order of OpenRouter for equal models: the newest first.
    .sort((a, b) =>
      cheapest ? cost(a) - cost(b) : Number(SUGGESTED.includes(b.id)) - Number(SUGGESTED.includes(a.id)),
    )

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center lg:items-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-bg/80" />
      <div
        role="dialog"
        aria-label="Add a horse"
        className="relative flex h-[92dvh] w-full max-w-2xl flex-col border-4 border-accent bg-bg motion-safe:animate-rise lg:h-[80dvh]"
      >
        <div className="flex items-center justify-between gap-4 px-4 pt-4">
          <h2 className="font-pixel text-[30px] leading-none">Add a horse</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-10 shrink-0 place-items-center border-2 border-text font-pixel text-[30px] leading-none hover:border-accent hover:text-accent"
          >
            X
          </button>
        </div>
        <div className="px-4 pt-4">
          <input
            autoFocus
            aria-label="Search a model"
            placeholder="Search a model"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={FIELD}
          />
        </div>
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          <button aria-pressed={!maker} onClick={() => setMaker(undefined)} className={FILTER}>
            All
          </button>
          {makers.map(([key]) => (
            <button key={key} aria-pressed={maker === key} onClick={() => setMaker(key)} className={FILTER}>
              {label(key)}
            </button>
          ))}
          <button aria-pressed={cheapest} onClick={() => setCheapest(!cheapest)} className={`${FILTER} ml-auto`}>
            Cheapest first
          </button>
        </div>
        <div className="mt-3 flex justify-between gap-4 border-y-2 border-line px-4 py-2 text-[12px] text-muted">
          <span>
            {found.length} {found.length === 1 ? 'model' : 'models'}
          </span>
          <span>Price per M tokens, in / out</span>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {found.slice(0, ROWS).map((option) => (
            <li key={option.id}>
              <button
                aria-pressed={model?.id === option.id}
                onClick={() => {
                  setModel(option)
                  setName(shortName(option).slice(0, 24))
                }}
                className="group flex w-full items-center justify-between gap-4 border-b-2 border-line px-4 py-3 text-left hover:bg-panel aria-pressed:bg-accent aria-pressed:text-on-accent"
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium [overflow-wrap:anywhere]">{shortName(option)}</span>
                  <span className="block text-[12px] text-muted [overflow-wrap:anywhere] group-aria-pressed:text-on-accent">{option.id}</span>
                </span>
                <span className="shrink-0 text-[13px] text-muted group-aria-pressed:text-on-accent">
                  {usd(option.prompt)} / {usd(option.completion)}
                </span>
              </button>
            </li>
          ))}
          {found.length === 0 && <li className="px-4 py-6 text-[14px] text-muted">No model matches</li>}
          {found.length > ROWS && <li className="px-4 py-4 text-[13px] text-muted">Search to see the other models.</li>}
        </ul>
        <form
          className="border-t-4 border-text p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          onSubmit={(event) => {
            event.preventDefault()
            setBusy(true)
            enterModel(race, model!.id, name.trim()).then(
              () => {
                onClose()
                navigate(`/race/${race}`)
              },
              (failure: Error) => {
                setError(failure.message)
                setBusy(false)
              },
            )
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              aria-label="Horse name"
              placeholder={model ? 'Horse name' : 'Pick a model first'}
              value={name}
              minLength={2}
              maxLength={24}
              required
              disabled={!model}
              onChange={(event) => setName(event.target.value)}
              className={FIELD}
            />
            <button
              disabled={busy || !model}
              className="h-12 shrink-0 bg-accent px-6 font-pixel text-[30px] leading-none text-on-accent hover:bg-accent-deep disabled:bg-line disabled:text-muted"
            >
              Enter the race
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-[14px]">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
