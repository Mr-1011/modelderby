// Pixel horses. A sprite is built from layers of spans, so each horse differs in shape and not only in color.
// A span is [part, row, first column, last column] in sprite pixels. The horse faces right.
type Span = [part: string, row: number, from: number, to: number]

export const SPRITE_W = 46
export const SPRITE_H = 27
export const FRAMES = 3 // 0 stands, 1 and 2 are the gallop

const BODY: Span[] = [
  ['B', 4, 34, 34], ['B', 5, 33, 35], ['B', 6, 32, 37], ['B', 7, 31, 40], ['B', 8, 30, 43], ['B', 9, 29, 43],
  ['B', 10, 28, 41], ['B', 11, 26, 34], ['B', 11, 36, 38], ['B', 11, 9, 13], ['B', 12, 9, 34], ['B', 13, 8, 33],
  ['B', 14, 7, 33], ['B', 15, 7, 32], ['B', 16, 7, 32], ['D', 17, 8, 31], ['D', 16, 26, 32], ['D', 12, 33, 34],
  ['D', 13, 32, 33], ['E', 7, 37, 37], ['N', 8, 42, 43], ['N', 9, 41, 43], ['N', 10, 39, 41],
]

// Per frame: the far legs first, so the near legs cover them.
const LEGS: Span[][] = [
  [
    ['L', 18, 14, 16], ['L', 19, 14, 15], ['L', 20, 14, 15], ['L', 21, 14, 15], ['L', 22, 14, 15], ['L', 23, 14, 15], ['H', 24, 14, 16],
    ['L', 18, 25, 27], ['L', 19, 26, 27], ['L', 20, 26, 27], ['L', 21, 26, 27], ['L', 22, 26, 27], ['L', 23, 26, 27], ['H', 24, 26, 28],
    ['B', 18, 8, 13], ['B', 19, 9, 13], ['B', 20, 10, 12], ['B', 21, 10, 12], ['S', 22, 10, 12], ['S', 23, 10, 12], ['H', 24, 10, 13],
    ['B', 18, 28, 32], ['B', 19, 29, 31], ['B', 20, 29, 31], ['B', 21, 29, 31], ['S', 22, 29, 31], ['S', 23, 29, 31], ['H', 24, 29, 32],
  ],
  [
    ['L', 18, 11, 16], ['L', 19, 10, 14], ['L', 20, 9, 12], ['L', 21, 8, 10], ['L', 22, 7, 9], ['L', 23, 6, 8], ['H', 24, 5, 7],
    ['L', 18, 25, 28], ['L', 19, 26, 29], ['L', 20, 27, 31], ['L', 21, 30, 33], ['L', 22, 32, 35], ['L', 23, 34, 37], ['H', 24, 36, 38],
    ['B', 18, 8, 14], ['B', 19, 6, 12], ['B', 20, 4, 9], ['B', 21, 3, 6], ['S', 22, 2, 4], ['S', 23, 1, 3], ['H', 24, 0, 2],
    ['B', 18, 27, 32], ['B', 19, 30, 34], ['B', 20, 33, 36], ['B', 21, 35, 38], ['S', 22, 37, 40], ['S', 23, 39, 41], ['H', 24, 41, 43],
  ],
  [
    ['L', 18, 8, 12], ['L', 19, 8, 10], ['L', 20, 9, 12], ['L', 21, 10, 13], ['L', 22, 12, 14], ['H', 23, 13, 15],
    ['L', 18, 29, 33], ['L', 19, 31, 33], ['L', 20, 31, 33], ['L', 21, 30, 32], ['L', 22, 29, 31], ['H', 23, 28, 30],
    ['B', 18, 9, 15], ['B', 19, 11, 16], ['B', 20, 13, 17], ['B', 21, 15, 18], ['S', 22, 16, 19], ['S', 23, 18, 20], ['H', 24, 19, 21],
    ['B', 18, 26, 31], ['B', 19, 27, 30], ['B', 20, 26, 29], ['S', 21, 24, 27], ['S', 22, 22, 25], ['H', 23, 21, 23],
  ],
]

const TAILS: Span[][] = [
  [['M', 10, 3, 7], ['M', 11, 1, 8], ['M', 12, 0, 8], ['M', 13, 0, 5], ['M', 14, 1, 3]], // streaming
  [['M', 11, 6, 8], ['M', 12, 5, 8], ['M', 13, 5, 7], ['M', 14, 5, 6]], // bobbed
  [['M', 6, 3, 5], ['M', 7, 2, 6], ['M', 8, 1, 6], ['M', 9, 1, 3], ['M', 9, 5, 7], ['M', 10, 0, 2], ['M', 10, 6, 8], ['M', 11, 0, 1], ['M', 11, 7, 8], ['M', 12, 7, 8]], // plume
]

const MANES: Span[][] = [
  [['M', 5, 32, 33], ['M', 6, 31, 32], ['M', 7, 30, 31], ['M', 8, 29, 30], ['M', 9, 28, 29], ['M', 10, 27, 28], ['M', 11, 26, 27]], // cropped
  [['M', 4, 31, 33], ['M', 5, 30, 33], ['M', 6, 28, 32], ['M', 7, 27, 31], ['M', 8, 26, 30], ['M', 9, 26, 29], ['M', 10, 25, 28], ['M', 11, 25, 27]], // flowing
  [['M', 3, 32, 32], ['M', 4, 31, 32], ['M', 5, 32, 33], ['M', 5, 29, 29], ['M', 6, 30, 32], ['M', 7, 30, 31], ['M', 7, 27, 27], ['M', 8, 28, 30], ['M', 9, 28, 29], ['M', 9, 25, 25], ['M', 10, 26, 28], ['M', 11, 26, 27]], // spiked
]

const BLAZE: Span[] = [['W', 5, 35, 35], ['W', 6, 36, 37], ['W', 7, 38, 40], ['W', 8, 41, 41]]
const PATCHES: Span[] = [
  ['W', 11, 10, 12], ['W', 12, 9, 13], ['W', 13, 9, 12], ['W', 14, 10, 11], ['W', 14, 24, 28], ['W', 15, 23, 29],
  ['W', 16, 24, 27], ['W', 8, 32, 34], ['W', 9, 31, 35], ['W', 10, 31, 33],
]
const BLANKET: Span[] = [
  ['W', 11, 9, 13], ['W', 12, 9, 13], ['W', 13, 8, 13], ['W', 14, 7, 12], ['W', 15, 7, 11], ['W', 16, 7, 9],
  ['B', 12, 11, 11], ['B', 13, 9, 9], ['B', 14, 11, 11], ['B', 15, 8, 8], ['B', 13, 12, 12],
]
const DAPPLES: Span[] = [
  ['W', 12, 11, 11], ['W', 14, 9, 9], ['W', 13, 23, 23], ['W', 15, 25, 25], ['W', 13, 27, 27], ['W', 15, 29, 29],
  ['W', 14, 31, 31], ['W', 16, 11, 11], ['W', 10, 30, 30], ['W', 15, 21, 21],
]
const HOOD: Span[] = [['J', 4, 34, 34], ['J', 5, 33, 35], ['J', 6, 32, 37], ['J', 7, 31, 36], ['J', 8, 30, 34], ['E', 7, 37, 37]]

const TACK: Span[] = [
  ['R', 8, 40, 40], ['R', 9, 40, 40], ['R', 10, 38, 38], ['R', 10, 29, 37], ['R', 7, 39, 39], ['R', 6, 36, 36],
  ['A', 11, 14, 19], ['X', 12, 14, 20], ['X', 13, 14, 19], ['X', 14, 14, 18],
]

const JOCKEY: Span[] = [
  ['C', 1, 22, 25], ['C', 2, 21, 28], ['C', 3, 21, 23], ['F', 3, 24, 27], ['F', 4, 23, 26],
  ['J', 5, 20, 26], ['J', 6, 17, 27], ['J', 7, 17, 24], ['J', 7, 26, 28], ['J', 8, 19, 23], ['J', 8, 27, 28],
  ['P', 7, 14, 16], ['P', 8, 14, 18], ['P', 9, 15, 20], ['P', 10, 17, 22], ['P', 11, 19, 23], ['F', 9, 27, 28],
  ['T', 12, 21, 23], ['T', 13, 20, 22], ['T', 14, 19, 23],
]

// A breed is a coat plus the markings that belong to it.
type Breed = { B: string; D: string; L: string; M: string; S: string; N: string; W: string; R: string; E: string; marks: Span[] }
const BREEDS: Breed[] = [
  { B: '#6e3414', D: '#55260d', L: '#3a1a09', M: '#140d09', S: '#140d09', N: '#2b1a12', W: '#f5f1e6', R: '#f5f1e6', E: '#000000', marks: [] }, // bay
  { B: '#c4c8d0', D: '#a0a5af', L: '#868b96', M: '#5d616b', S: '#868b96', N: '#55585f', W: '#e9ebef', R: '#16161a', E: '#000000', marks: DAPPLES }, // dapple grey
  { B: '#26262d', D: '#19191e', L: '#101014', M: '#08080a', S: '#f5f1e6', N: '#08080a', W: '#f5f1e6', R: '#f5f1e6', E: '#f5f1e6', marks: BLAZE }, // black
  { B: '#e6c067', D: '#c79f48', L: '#a9853a', M: '#fff7df', S: '#fff7df', N: '#8a6a3a', W: '#fff7df', R: '#3a2412', E: '#000000', marks: BLAZE }, // palomino
  { B: '#4a2816', D: '#39200f', L: '#2a160a', M: '#f5f1e6', S: '#f5f1e6', N: '#24130a', W: '#f5f1e6', R: '#16161a', E: '#000000', marks: PATCHES }, // pinto
  { B: '#6c7f99', D: '#55667e', L: '#42516a', M: '#1b1f27', S: '#1b1f27', N: '#1b1f27', W: '#dfe5ee', R: '#f5f1e6', E: '#000000', marks: [] }, // blue roan
  { B: '#8f3214', D: '#72250c', L: '#571c08', M: '#ecd08a', S: '#f5f1e6', N: '#4a1a0a', W: '#f5f1e6', R: '#16161a', E: '#000000', marks: BLAZE }, // flaxen chestnut
  { B: '#3b2417', D: '#2c1a10', L: '#20130b', M: '#120b07', S: '#3b2417', N: '#a56a42', W: '#f5f1e6', R: '#f5f1e6', E: '#000000', marks: BLANKET }, // appaloosa
  { B: '#f1f0ea', D: '#d6d5cd', L: '#bdbcb4', M: '#dcdad0', S: '#f1f0ea', N: '#9a8f8a', W: '#ffffff', R: '#16161a', E: '#000000', marks: [] }, // white
]

// Silks: [main, second, cap]. No orange, because the horses stand on orange.
const SILKS: [string, string, string][] = [
  ['#1552d8', '#ffd21f', '#ffd21f'],
  ['#f5f1e6', '#d8112b', '#d8112b'],
  ['#0a9b4b', '#ffd21f', '#0a9b4b'],
  ['#7a2bd6', '#f5f1e6', '#f5f1e6'],
  ['#ffd21f', '#16161a', '#16161a'],
  ['#d8112b', '#f5f1e6', '#1552d8'],
  ['#12b5c2', '#16161a', '#12b5c2'],
  ['#ff5fae', '#1552d8', '#ff5fae'],
  ['#16161a', '#ffd21f', '#ffd21f'],
]

// The second silks color goes where the pattern says: plain, hoops, sash, halves, checks.
const PATTERNS: ((x: number, y: number) => boolean)[] = [
  () => false,
  (_x, y) => y % 2 === 0,
  (x, y) => Math.abs(x + y * 2 - 35) < 2,
  (x) => x < 21,
  (x, y) => ((x >> 1) + (y >> 1)) % 2 === 0,
]

export type Look = { breed: number; tail: number; mane: number; hood: boolean; silks: number; pattern: number }

// The same horse id always gives the same horse. The house horses h1..h8 get different breeds and silks.
export function lookOf(id: string): Look {
  let n = 2166136261
  for (let i = 0; i < id.length; i++) n = Math.imul(n ^ id.charCodeAt(i), 16777619) >>> 0
  const house = /^h(\d+)$/.exec(id)
  const k = house ? Number(house[1]) - 1 : n
  return {
    breed: k % BREEDS.length,
    silks: (house ? k : n >>> 16) % SILKS.length,
    tail: (n >>> 4) % TAILS.length,
    mane: (n >>> 8) % MANES.length,
    hood: (n >>> 12) % 4 === 0,
    pattern: (n >>> 20) % PATTERNS.length,
  }
}

// One frame as a grid of colors. null is transparent.
export function drawFrame(look: Look, frame: number): (string | null)[][] {
  const { marks, ...coat } = BREEDS[look.breed]
  const [main, second, cap] = SILKS[look.silks]
  const colors: Record<string, string> = {
    ...coat, H: '#0c0a08', A: '#2a1a10', X: second, C: cap, F: '#f0b98d', P: '#f5f1e6', T: '#16161a',
  }
  const grid: (string | null)[][] = Array.from({ length: SPRITE_H }, () => Array(SPRITE_W).fill(null))
  const paint = (spans: Span[]) => {
    for (const [part, row, from, to] of spans)
      for (let x = from; x <= to; x++)
        grid[row + 1][x + 1] = part === 'J' ? (PATTERNS[look.pattern](x, row) ? second : main) : colors[part]
  }
  const far = LEGS[frame].length / 2
  paint(LEGS[frame].slice(0, far))
  paint(TAILS[look.tail])
  paint(BODY)
  paint(LEGS[frame].slice(far))
  paint(marks)
  paint(MANES[look.mane])
  if (look.hood) paint(HOOD)
  paint(TACK)
  paint(JOCKEY)

  // A black outline, so every coat reads on every background.
  return grid.map((line, y) =>
    line.map(
      (color, x) =>
        color ?? (grid[y - 1]?.[x] || grid[y + 1]?.[x] || line[x - 1] || line[x + 1] ? '#000000' : null),
    ),
  )
}
