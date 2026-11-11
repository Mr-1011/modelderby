// A pixel image of a challenge, 16x16. "#" is the text color, "o" is the accent and "+" is muted.
// A challenge without a drawn image gets a generated one from its name, so a new challenge needs no new art.
const ART: Record<string, string[]> = {
  // A safe with its dial.
  vault: [
    '................',
    '.##############.',
    '.#............#.',
    '.#.++++++++++.#.',
    '.#.+........+.#.',
    '.#.+...oo...+.#.',
    '.#.+..o..o..+.#.',
    '.#.+.o.##.o.+.#.',
    '.#.+.o.##.o.+.#.',
    '.#.+..o..o..+.#.',
    '.#.+...oo...+.#.',
    '.#.+........+.#.',
    '.#.++++++++++.#.',
    '.#............#.',
    '.##############.',
    '..##........##..',
  ],
  // One face of a cube puzzle.
  cube: [
    '................',
    '.####.oooo.++++.',
    '.####.oooo.++++.',
    '.####.oooo.++++.',
    '.####.oooo.++++.',
    '................',
    '.oooo.++++.####.',
    '.oooo.++++.####.',
    '.oooo.++++.####.',
    '.oooo.++++.####.',
    '................',
    '.++++.####.oooo.',
    '.++++.####.oooo.',
    '.++++.####.oooo.',
    '.++++.####.oooo.',
    '................',
  ],
  // A globe, for research on the web.
  web: [
    '................',
    '.....######.....',
    '...##..+...##...',
    '..#....+.....#..',
    '..#...+.+....#..',
    '.#....+..+....#.',
    '.#oooooooooooo#.',
    '.#...+....+...#.',
    '.#...+....+...#.',
    '.#oooooooooooo#.',
    '.#....+..+....#.',
    '..#...+.+....#..',
    '..#....+.....#..',
    '...##..+...##...',
    '.....######.....',
    '................',
  ],
}

// A pattern with mirror symmetry from a hash of the name. The same name always gives the same image.
function generated(name: string) {
  let seed = [...name].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)
  const next = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32
  return Array.from({ length: 16 }, (_, y) => {
    const half = Array.from({ length: 8 }, (_, x) =>
      y < 1 || y > 14 || x < 1 || next() < 0.45 ? '.' : next() < 0.25 ? 'o' : next() < 0.3 ? '+' : '#',
    )
    return [...half, ...half.slice().reverse()].join('')
  })
}

const FILL: Record<string, string> = { '#': 'fill-text', o: 'fill-accent', '+': 'fill-muted' }

// px is the size of one pixel of the image. The image falls apart and builds itself again, row by row.
export default function Glyph({ name, px }: { name: string; px: number }) {
  const rows = ART[name] ?? generated(name)
  return (
    <svg width={16 * px} height={16 * px} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden className="shrink-0">
      {rows.flatMap((row, y) =>
        [...row].map(
          (pixel, x) =>
            pixel !== '.' && (
              <rect
                key={`${x} ${y}`}
                x={x}
                y={y}
                width={1}
                height={1}
                className={`${FILL[pixel]} motion-safe:animate-assemble`}
                style={{ animationDelay: `${(15 - y) * 70 + ((x * 7 + y * 13) % 5) * 40}ms` }}
              />
            ),
        ),
      )}
    </svg>
  )
}
