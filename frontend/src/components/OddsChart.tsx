import { winChanceHistory } from '@horserace/shared'
import { useState } from 'react'
import { odds } from '../lib/format'
import type { LiveRace } from '../lib/queries'
import { colorOf } from '../lib/sprite'

const W = 448
const H = 200
const AXIS = 34

// The Win chance of each horse over time: the share of the Win pool that is on it. `end` is the right edge in ms.
export default function OddsChart({ view, end }: { view: LiveRace; end: number }) {
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

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
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
        {horses.map((horse) => (
          <path
            key={horse.id}
            fill="none"
            strokeWidth={2}
            stroke={colorOf(horse.id).color}
            // A step line: the chance holds until the next bet.
            d={
              points
                .filter((point) => horse.id in point.chance)
                .map((point, n) => `${n ? 'H' : 'M'}${x(point.at)}${n ? 'V' : ','}${y(point.chance[horse.id])}`)
                .join('') + `H${W}`
            }
          />
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} className="stroke-text" />}
      </svg>
      <figcaption>
        <ul className="mt-3 text-[14px]">
          {horses.map((horse) => (
            <li key={horse.id} className="flex items-center gap-3 py-1">
              <i className="size-3 shrink-0" style={{ background: colorOf(horse.id).color }} />
              <span className="min-w-0 grow truncate">{horse.name}</span>
              {horse.id in shown.chance && (
                <span className="shrink-0 text-muted">
                  {Math.round(shown.chance[horse.id] * 100)}%, {odds(1 / shown.chance[horse.id])}
                </span>
              )}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}
