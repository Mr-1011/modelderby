import { blurbOf } from '@modelderby/shared'
import { Link } from 'react-router-dom'
import { odds, usd } from '../lib/format'
import { useRace } from '../lib/queries'
import { ROOMS, statusOf } from '../lib/race'
import Glyph from './Glyph'
import Horse from './Horse'
import Track, { grass, Rail } from './Track'

// The place of the large race while it loads. It has the height of an open race, so the list below does not move.
export function FeaturedSkeleton() {
  return (
    <div aria-hidden className="mt-4 h-[484px] border-2 border-line bg-panel motion-safe:animate-load lg:h-[340.5px]">
      <div className="flex items-center gap-6 p-4 lg:p-6">
        <div className="size-16 shrink-0 bg-line lg:size-32" />
        <div className="min-w-0 grow">
          <div className="h-[30px] w-48 max-w-full bg-line lg:h-[60px] lg:w-80" />
          <div className="mt-3 h-3 w-64 max-w-full bg-line lg:w-96" />
        </div>
      </div>
    </div>
  )
}

// The race on top of the race list, large and live: the horses with their odds before the start,
// then the track with the horses at their real positions.
export default function FeaturedRace({ id, now }: { id: number; now: number }) {
  const { data: view } = useRace(id)
  if (!view) return <FeaturedSkeleton />
  const { race, lanes } = view
  const wide = window.innerWidth >= 1024
  const winner = lanes.find((lane) => lane.horse.id === race.winner_horse)
  const status = statusOf(race, now, winner?.horse.name)
  return (
    <Link to={`/race/${id}`} className="mt-4 block border-2 border-accent bg-panel hover:outline-2 hover:outline-accent">
      {/* On a wide screen the status is on the line of the title. On a phone it has its own row. */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-4 p-4 lg:grid-cols-[auto_1fr_auto] lg:items-baseline lg:p-6">
        <div className="lg:self-center">
          <Glyph name={race.task} px={wide ? 4 : 2} />
        </div>
        <div className="min-w-0">
          <h2 className="truncate font-pixel text-[30px] leading-none lg:text-[60px]">{ROOMS[race.task] ?? race.task}</h2>
          <p className="mt-2 max-w-[52ch] text-balance text-[13px] leading-5 text-muted lg:text-[15px]">{blurbOf(race.task, race.level)}</p>
        </div>
        <p className="col-span-2 font-pixel text-[30px] leading-none text-accent lg:col-span-1">
          {winner ? `${status}, ${usd(winner.entry.cost_usd)}` : status}
        </p>
      </div>
      {race.status === 'open' ? (
        <ol className="flex flex-wrap border-t-2 border-line">
          {lanes.map(({ horse, win }) => (
            <li key={horse.id} className="min-w-0 basis-1/3 lg:flex-1">
              <div className="flex justify-center pb-1 pt-5" style={grass(2)}>
                <Horse id={horse.id} scale={2} idle />
              </div>
              <div className="px-1 py-3 text-center">
                <p className="truncate font-pixel text-[15px] leading-none lg:text-[22.5px]">{horse.name}</p>
                <p className="mt-1 font-pixel text-[30px] leading-none text-accent">{odds(win)}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="border-t-2 border-line">
          <div className="h-5">
            <Rail px={2} />
          </div>
          {lanes.map((lane, i) => (
            <div key={lane.horse.id} className="h-9">
              <Track lane={lane} px={2} settled={race.status === 'settled'} stripe={i} />
            </div>
          ))}
          <div className="h-3">
            <Rail px={2} />
          </div>
        </div>
      )}
    </Link>
  )
}
