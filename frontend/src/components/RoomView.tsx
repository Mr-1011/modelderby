import { STICKER } from '../lib/sprite'

// Where each face of the cube goes in the net: U on top, then L, F, R, B in one row, then D below F.
// The view has the faces in the order U, R, F, D, L, B.
const NET = [[3, 0], [6, 3], [3, 3], [3, 6], [0, 3], [9, 3]]
// The rover map: wall, package, goal, rover, rover with the package.
const CELL: Record<string, string> = { '#': 'fill-line', P: 'fill-accent', G: 'fill-muted', R: 'fill-text', C: 'fill-text' }

// The challenge state of one horse as a small pixel picture: the net of its cube, or the map of its rover.
// cell is the size of one sticker or of one map cell.
export default function RoomView({ view, cell }: { view: string; cell: number }) {
  const rows = view.includes('/') ? view.split('/') : null
  const [w, h] = rows ? [rows[0].length, rows.length] : [12, 9]
  return (
    <svg width={w * cell} height={h * cell} shapeRendering="crispEdges" aria-hidden className="shrink-0">
      {rows
        ? rows.flatMap((row, y) =>
            [...row].map(
              (char, x) => CELL[char] && <rect key={`${x} ${y}`} x={x * cell} y={y * cell} width={cell} height={cell} className={CELL[char]} />,
            ),
          )
        : [...view].map((letter, i) => (
            <rect
              key={i}
              x={(NET[Math.floor(i / 9)][0] + (i % 3)) * cell}
              y={(NET[Math.floor(i / 9)][1] + Math.floor((i % 9) / 3)) * cell}
              width={cell - 1}
              height={cell - 1}
              fill={STICKER[letter]}
            />
          ))}
    </svg>
  )
}
