import { type CSSProperties, memo, useState } from 'react'

// A 3D pixel image of a challenge on a grid of 32x32. A challenge without a drawn image gets a generated cube
// from its name, so a new challenge needs no new art.

// A pixel is a color token (T text, A accent, M muted, L line) and a shade: 0 is in the light, 2 is in the shadow.
type Pixel = [token: string, shade: number] | null
// What a face of a box shows at one of its 16x16 pixels. An empty string is a hole.
type Face = (x: number, y: number) => string
type Box = { top: Face; left: Face; right: Face }

const N = 32
const FILL: Record<string, string> = { T: 'fill-text', A: 'fill-accent', M: 'fill-muted', L: 'fill-line' }
const SHADE = [1, 0.7, 0.45]

// A box in the view of a pixel game: the top is a diamond, and each line runs 2 pixels across for 1 pixel down.
function box({ top, left, right }: Box): Pixel[][] {
  return Array.from({ length: N }, (_, y) =>
    Array.from({ length: N }, (_, x): Pixel => {
      // The right half mirrors the left half.
      const half = Math.floor((x < 16 ? x : 31 - x) / 2)
      if (y >= 7 - half && y <= 8 + half) {
        const [dx, dy] = [(x - 15.5) / 2, y - 7.5]
        return [top(Math.min(15, Math.floor(dx + dy + 8)), Math.min(15, Math.floor(dy - dx + 8))), 0]
      }
      const side = y - 9 - half
      if (side < 0 || side > 15) return null
      const token = x < 16 ? left(x, side) : right(x - 16, side)
      return token ? [token, x < 16 ? 1 : 2] : null
    }),
  )
}

// A face of 3x3 stickers, each 4 pixels wide, with dark lines between them.
const stickers =
  (colors: string): Face =>
  (x, y) =>
    x % 5 === 0 || y % 5 === 0 ? 'L' : colors[Math.floor(y / 5) * 3 + Math.floor(x / 5)]

const edge = (x: number, y: number) => x === 0 || y === 0 || x === 15 || y === 15

// An image that is not a box: a function gives each of its pixels.
const paint = (pixel: (x: number, y: number) => Pixel): Pixel[][] =>
  Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => pixel(x, y)))

const ART: Record<string, () => Pixel[][]> = {
  // A safe: the door with its dial and handle is the left face.
  vault: () =>
    box({
      top: (x, y) => (edge(x, y) ? 'T' : 'M'),
      left: (x, y) => {
        const ring = Math.hypot(x - 6.5, y - 7.5)
        if (edge(x, y)) return 'T'
        if (ring < 1.2) return 'T'
        if (ring > 2.4 && ring < 4) return 'A'
        if (x >= 12 && x <= 13 && y >= 5 && y <= 10) return 'T'
        return x === 2 || y === 2 || x === 14 || y === 13 ? 'L' : 'M'
      },
      right: (x, y) => (edge(x, y) ? 'T' : y % 4 === 2 && x > 3 && x < 12 ? 'L' : 'M'),
    }),
  // A rover: a solar panel on top, and two wheels on each side.
  rover: () => {
    const side: Face = (x, y) => {
      const wheel = Math.min(Math.hypot(x - 4, y - 11.5), Math.hypot(x - 11.5, y - 11.5))
      if (wheel < 1.3) return 'T'
      if (wheel < 2.6) return 'L'
      if (wheel < 3.9) return 'M'
      if (y > 8) return ''
      return edge(x, y) || y === 8 ? 'T' : y === 4 && x > 2 && x < 13 ? 'A' : 'M'
    }
    return box({ top: (x, y) => (edge(x, y) ? 'T' : x % 5 === 0 || y % 5 === 0 ? 'L' : 'A'), left: side, right: side })
  },
  // A cube puzzle with mixed stickers.
  cube: () => box({ top: stickers('TATMTATMT'), left: stickers('AMTTAMMTA'), right: stickers('MTAATMTAM') }),
  // A dark box in five layers: four rings on top around a bright core, slits on the right, and the keyhole on the left.
  blackbox: () =>
    box({
      top: (x, y) => {
        const ring = Math.floor(Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)))
        return ring === 7 ? 'T' : ring === 0 ? 'A' : ring === 3 || ring === 4 ? 'M' : 'L'
      },
      left: (x, y) => {
        if (edge(x, y)) return 'T'
        const hole = Math.hypot(x - 7.5, y - 5.5) < 2.3 || (y > 6 && y < 12 && Math.abs(x - 7.5) < 1 + (y - 7) / 4)
        return hole ? 'A' : 'L'
      },
      right: (x, y) => (edge(x, y) ? 'T' : y % 3 === 1 && x > 3 && x < 12 ? 'M' : 'L'),
    }),
  // A ladybug from above: the shell with its spots and the line between the wings, the head, two feelers and six legs.
  bughunt: () =>
    paint((x, y) => {
      const [dx, dy] = [x - 15.5, y - 18.5]
      const side = Math.abs(dx)
      if ((dx / 10.5) ** 2 + (dy / 11.5) ** 2 < 1) {
        const spot = [[5, -5, 2.2], [6.2, 2, 2.4], [3.2, 7.5, 1.8]].some(([sx, sy, r]) => Math.hypot(side - sx, dy - sy) < r)
        if (side < 1 || spot) return ['L', 0]
        return ['A', dx + dy > 7 ? 2 : dx + dy > -4 ? 1 : 0]
      }
      if (Math.hypot(dx, y - 7) < 4.6) return [y === 4 && side > 1 && side < 3 ? 'T' : 'M', 0]
      if (y < 3 && side === 5.5 - y) return ['M', 0]
      // Each leg goes out from the shell and ends in a foot.
      const leg = [[12, 13, -1], [19, 14, 1], [26, 12, 1]].some(
        ([row, reach, foot]) => (y === row && side < reach) || (y === row + foot && side === reach - 0.5),
      )
      return leg ? ['M', 0] : null
    }),
  // A snail on a road: the shell with its spiral, the body with two eyes on stalks, and the marks of the lane.
  slowlane: () =>
    paint((x, y) => {
      const [dx, dy] = [x - 19.5, y - 12.5]
      const r = Math.hypot(dx, dy)
      if (r < 9.6) {
        const turn = (Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1
        if (r < 8.4 && [0, 1, 2].some((n) => Math.abs(r - 3 * (turn + n)) < 0.6)) return ['L', 0]
        return ['A', r > 8.4 ? 2 : dx + dy > 4 ? 1 : 0]
      }
      if ((x === 3 || x === 7) && y >= 9 && y < 15) return y < 11 ? ['T', 0] : ['M', 0]
      if (x >= 3 && x <= 7 && y >= 15 && y < 22 && (y > 15 || (x > 3 && x < 7))) return ['T', 0]
      if (y >= 22 && y <= 26 && x >= 2 && x <= 24 + (y - 22) * 1.5) return y === 26 ? ['M', 0] : ['T', 0]
      return y >= 29 && y <= 30 && x % 8 < 5 ? ['M', 1] : null
    }),
  // Two sheets of paper with lines of text, and a magnifying glass on them.
  papertrail: () =>
    paint((x, y) => {
      const lens = Math.hypot(x - 21.5, y - 20.5)
      if (lens < 6.2) {
        if (lens > 4.4) return ['A', 0]
        return (y === 20 || y === 21) && Math.abs(x - 21.5) < 3 ? ['L', 0] : ['T', x + y < 39 ? 0 : 1]
      }
      if (Math.abs(x - y - 1) <= 1 && x >= 26) return ['A', 2]
      // The front sheet has a cut corner on the top right.
      if (x >= 4 && x <= 19 && y >= 6 && y <= 29 && x - y <= 9) {
        const line = [10, 13, 16, 19, 22, 25].indexOf(y)
        if (x - y === 9) return ['M', 0]
        return line >= 0 && x >= 6 && x < 6 + [9, 11, 7, 11, 5, 9][line] ? ['L', 0] : ['T', 0]
      }
      return x >= 9 && x <= 24 && y >= 3 && y <= 26 ? ['T', 2] : null
    }),
  // A plaster over a crack: the pad with its holes in the middle, and small holes in the two ends.
  thepatch: () =>
    paint((x, y) => {
      const [dx, dy] = [Math.abs(x - 15.5), y - 15.5]
      // The strip has round ends.
      if (Math.abs(dy) < 6 && (dx < 9 || Math.hypot(dx - 9, dy) < 6)) {
        const hole = (step: number) => Math.floor(dx) % step === 1 && Math.floor(Math.abs(dy)) % 2 === 1
        if (dx < 5) return dx < 4 && Math.abs(dy) < 4 && hole(2) ? ['L', 0] : ['A', dy > 2 ? 1 : 0]
        return dx > 10 && dx < 14 && Math.abs(dy) < 2 && hole(3) ? ['M', 0] : ['T', dy > 2 ? 1 : 0]
      }
      // The crack runs down in a zigzag.
      const crack = 15 + [0, 1, 2, 3, 2, 1, 0, -1, -2, -1][y % 10]
      return x === crack || x === crack + 1 ? ['M', 0] : null
    }),
  // An open logbook: two pages of entries, and one entry in another color. A ribbon marks the page.
  coldcase: () =>
    paint((x, y) => {
      const page = x < 16 ? x - 3 : x - 17
      if (y >= 6 && y <= 25 && page >= 0 && page <= 11) {
        const line = [8, 11, 14, 17, 20, 23].indexOf(y)
        const forged = x > 16 && line === 2
        if (line >= 0 && page >= 1 && page <= [9, 7, 10, 6, 9, 8][(line + (x < 16 ? 0 : 2)) % 6]) return [forged ? 'A' : 'L', 0]
        return ['T', x < 16 ? 1 : 0]
      }
      if ((x === 22 || x === 23) && y > 25 && y <= 30) return ['A', 1]
      if ((x === 15 || x === 16) && y >= 5 && y <= 26) return ['L', 0]
      return x >= 1 && x <= 30 && y >= 4 && y <= 27 ? ['M', 1] : null
    }),
  // A globe with its grid, for research on the web. The light comes from the top left.
  web: () =>
    Array.from({ length: N }, (_, y) =>
      Array.from({ length: N }, (_, x): Pixel => {
        const [dx, dy] = [x - 15.5, y - 15.5]
        const r = Math.hypot(dx, dy)
        if (r > 15.6) return null
        const width = Math.sqrt(Math.max(0, 15.6 ** 2 - dy ** 2))
        const light = (-0.5 * dx - 0.6 * dy + 0.62 * Math.sqrt(Math.max(0, 15.6 ** 2 - r ** 2))) / 15.6
        // Between two shades, every second pixel takes the darker one.
        const shade = light > 0.5 ? 0 : light > 0.42 ? (x + y) % 2 : light > 0.05 ? 1 : light > -0.03 ? 1 + ((x + y) % 2) : 2
        if (r > 14.6) return ['T', shade]
        const grid = [-11, -5.5, 0.5, 5.5, 11].some((row) => Math.abs(dy - row) < 0.6) || [-0.62, 0, 0.62].some((k) => Math.abs(dx - k * width) < 0.7)
        return [grid ? 'A' : 'M', shade]
      }),
    ),
}

// A cube with a sticker pattern from a hash of the name. The same name always gives the same image.
function generated(name: string) {
  let seed = [...name].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)
  const face = () =>
    stickers(Array.from({ length: 9 }, () => 'TAMML'[(seed = (seed * 1664525 + 1013904223) >>> 0) % 5]).join(''))
  return box({ top: face(), left: face(), right: face() })
}

// The pixels of an image as rectangles: one for each run of equal pixels in a row. Drawn once for each name.
const cache = new Map<string, { x: number; y: number; width: number; pixel: [string, number] }[]>()
function runs(name: string) {
  let found = cache.get(name)
  if (!found) {
    found = []
    ;(ART[name] ?? (() => generated(name)))().forEach((row, y) => {
      for (let x = 0; x < N; ) {
        const pixel = row[x]
        let end = x + 1
        while (end < N && row[end]?.[0] === pixel?.[0] && row[end]?.[1] === pixel?.[1]) end++
        if (pixel) found!.push({ x, y, width: end - x, pixel })
        x = end
      }
    })
    cache.set(name, found)
  }
  return found
}

// px is the size of one pixel of the image. About every 10 seconds the image falls apart and builds itself again
// from the bottom, and a few bright pixels are dim now and then. Each image has its own times, so the images do not move together.
export default memo(function Glyph({ name, px }: { name: string; px: number }) {
  const [seed] = useState(Math.random)
  // A number from 0 to 1 that stays the same for this image and for n.
  const rand = (n: number) => {
    const value = Math.sin(seed * 1000 + n * 12.9898) * 43758.5453
    return value - Math.floor(value)
  }
  const cycle = 10 + rand(-1) * 6
  const phase = -rand(-2) * cycle * 1000
  return (
    <svg
      width={N * px}
      height={N * px}
      viewBox={`0 0 ${N} ${N}`}
      shapeRendering="crispEdges"
      aria-hidden
      className="glyph shrink-0"
      style={{ '--cycle': `${cycle}s` } as CSSProperties}
    >
      {runs(name).map(({ x, y, width, pixel: [token, shade] }, i) => {
        const glint = (token === 'A' || token === 'T') && rand(i) < 0.12
        const times: Record<string, string | number> = { '--at': `${phase + (N - 1 - y) * 40 + (x % 3) * 60}ms` }
        if (glint) Object.assign(times, { '--o': SHADE[shade], '--glint': `${7 + rand(i + 0.5) * 5}s`, '--glint-at': `${-rand(i + 0.25) * 12}s` })
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={width}
            height={1}
            fillOpacity={SHADE[shade]}
            className={glint ? `glint ${FILL[token]}` : FILL[token]}
            style={times as CSSProperties}
          />
        )
      })}
    </svg>
  )
})
