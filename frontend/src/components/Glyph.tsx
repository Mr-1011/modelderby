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

// px is the size of one pixel of the image. The image falls apart and builds itself again from the bottom.
export default function Glyph({ name, px }: { name: string; px: number }) {
  return (
    <svg width={N * px} height={N * px} viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges" aria-hidden className="shrink-0">
      {runs(name).map(({ x, y, width, pixel: [token, shade] }) => (
        <rect
          key={`${x} ${y}`}
          x={x}
          y={y}
          width={width}
          height={1}
          fillOpacity={SHADE[shade]}
          className={`${FILL[token]} motion-safe:animate-assemble`}
          style={{ animationDelay: `${(N - 1 - y) * 40 + (x % 3) * 60}ms` }}
        />
      ))}
    </svg>
  )
}
