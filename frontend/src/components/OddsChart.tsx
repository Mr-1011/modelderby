import { winChanceHistory } from '@horserace/shared'
import { useState } from 'react'
import { odds } from '../lib/format'
import type { LiveRace } from '../lib/queries'
import { colorOf } from '../lib/sprite'

// The chart is drawn at the size of its place on the page, so its text has the same size on each screen.
// On a wide screen the chart has two thirds of the width, and the names of the horses are on its right.
const WIDE = window.innerWidth >= 1024
const W = WIDE ? 736 : 448
const H = WIDE ? 240 : 200
const AXIS = 34

// The Win chance of each horse over time: the share of the Win pool that is on it. `end` is the right edge in ms.
// active is the horse that the page highlights. The pointer on a line or on a name sets it.
export default function OddsChart({
  view, end, active, onActive,
}: {
  view: LiveRace; end: number; active: string | null; onActive: (horse: string | null) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const points = winChanceHistory(view.bets)
  if (points.length === 0) return null

  const horses = view.lanes.map((lane) => lane.horse)
  const start = points[0].at
  const span = Math.max(end - start, 1)
  const top = Math.ceil(Math.max(...points.flatMap((point) => Object.values(point.chance))) * 10) / 10
  const x = (at: number) => AXIS + ((W - AXIS) * (at - start)) / span
  const y = (chance: number) => H - (H * chance) / top
  // The values under the pointer, or the newest values.
  const shown = points.filter((point) => hover === null || point.at <= hover).at(-1) ?? points[0]
  // A finger has no hover, so a tap on a line keeps the highlight.
  const pick = (horse: string) => ({
    onPointerEnter: () => onActive(horse),
    onPointerLeave: (event: React.PointerEvent) => event.pointerType === 'mouse' && onActive(null),
  })
  const dim = (horse: string) => (active && active !== horse ? 0.4 : 1)

  return (
    <figure className="lg:grid lg:grid-cols-3 lg:gap-x-8">
      <h2 className="mb-3 font-pixel text-[30px] leading-none lg:col-span-3">Chance to win</h2>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none lg:col-span-2"
        // The lines have only horizontal and vertical parts, so they can be as sharp as the pixel art.
        shapeRendering="crispEdges"
        role="img"
        aria-label="Win chance of each horse over time"
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          const at = start + (((event.clientX - box.left) / box.width) * W - AXIS) * (span / (W - AXIS))
          setHover(Math.min(Math.max(at, start), end))
        }}
        onPointerLeave={() => setHover(null)}
      >
        {[0, top / 2, top].map((chance) => (
          <g key={chance}>
            <line x1={AXIS} x2={W} y1={y(chance)} y2={y(chance)} className="stroke-line" />
            <text x={0} y={y(chance)} dy={chance === top ? 11 : chance === 0 ? -2 : 4} className="fill-muted text-[11px]">
              {Math.round(chance * 100)}%
            </text>
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} className="stroke-muted" />}
        {/* The active line is drawn last, so no other line hides it. */}
        {[...horses].sort((a, b) => Number(a.id === active) - Number(b.id === active)).map((horse) => {
          // A step line: the chance holds until the next bet.
          const d =
            points
              .filter((point) => horse.id in point.chance)
              .map((point, n) => `${n ? 'H' : 'M'}${x(point.at)}${n ? 'V' : ','}${y(point.chance[horse.id])}`)
              .join('') + `H${W}`
          return (
            <g key={horse.id} fill="none">
              <path d={d} strokeWidth={horse.id === active ? 4 : 2} stroke={colorOf(horse.id).color} opacity={dim(horse.id)} />
              {/* A wide line that is not visible, so the pointer finds the thin line. */}
              <path d={d} strokeWidth={14} stroke="transparent" pointerEvents="stroke" {...pick(horse.id)} />
            </g>
          )
        })}
      </svg>
      <figcaption>
        <ul className="mt-3 grid grid-cols-2 gap-x-6 text-[13px] lg:mt-0 lg:grid-cols-1 lg:text-[14px]">
          {horses.map((horse) => (
            <li key={horse.id} className="flex items-center gap-2 py-1" style={{ opacity: dim(horse.id) }} {...pick(horse.id)}>
              <i className="size-3 shrink-0" style={{ background: colorOf(horse.id).color }} />
              <span className="min-w-0 grow truncate">{horse.name}</span>
              {horse.id in shown.chance && (
                <span className="shrink-0 text-muted">
                  {Math.round(shown.chance[horse.id] * 100)}%<span className="hidden lg:inline">, {odds(1 / shown.chance[horse.id])}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}
