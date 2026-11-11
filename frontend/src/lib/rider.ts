import type { Player } from '@modelderby/shared'
import { outline } from './sprite'

// Pixel riders. A player builds a rider on the profile page, and it is the public icon of that player.
// A layer is rows of color keys, and a dot is transparent. The rider looks at the viewer.
export const RIDER_W = 20
export const RIDER_H = 22

// Rows 4 to 19: a man and a woman.
// F skin, E eye, M hair, J top (the pattern picks its main or its second color), B sleeve, P pants, T boot.
const BODIES = [
  [
    '......MMMMMM......',
    '.....MMMMMMMM.....',
    '.....MMMMMMMM.....',
    '.....MFFFFFFM.....',
    '.....FFEFFEFF.....',
    '.....FFFFFFFF.....',
    '......FFFFFF......',
    '....BBJJJJJJBB....',
    '....BBJJJJJJBB....',
    '....BBJJJJJJBB....',
    '....FFJJJJJJFF....',
    '......PPPPPP......',
    '......PPPPPP......',
    '......PP..PP......',
    '......TT..TT......',
    '.....TTT..TTT.....',
  ],
  [
    '......MMMMMM......',
    '.....MMMMMMMM.....',
    '....MMMMMMMMMM....',
    '....MMFFFFFFMM....',
    '....MFFEFFEFFM....',
    '....MFFFFFFFFM....',
    '....MMFFFFFFMM....',
    '....MBJJJJJJBM....',
    '....MBJJJJJJBM....',
    '.....BJJJJJJB.....',
    '.....FJJJJJJF.....',
    '......PPPPPP......',
    '......PPPPPP......',
    '......PP..PP......',
    '......TT..TT......',
    '.....TTT..TTT.....',
  ],
]

// Rows 0 to 7. A and B are the two colors of the top. The lowercase keys are in INK.
const HATS = [
  [], // no hat
  [ // jockey cap
    '',
    '',
    '........BB........',
    '......AAAAAA......',
    '.....AAAAAAAA.....',
    '.....AAAAAAAA.....',
    '....BBBBBBBBBB....',
  ],
  [ // helmet with goggles
    '',
    '',
    '',
    '......AAAAAA......',
    '.....AAAAAAAA.....',
    '.....BBBBBBBB.....',
    '.....kcckkcck.....',
  ],
  [ // cowboy hat
    '',
    '',
    '......hh..hh......',
    '......hhhhhh......',
    '.h....nnnnnn....h.',
    '.hhhhhhhhhhhhhhhh.',
  ],
  [ // top hat
    '......kkkkkk......',
    '......kkkkkk......',
    '......kkkkkk......',
    '......kkkkkk......',
    '......rrrrrr......',
    '....kkkkkkkkkk....',
  ],
  [ // beanie
    '',
    '........ww........',
    '.......AAAA.......',
    '......AAAAAA......',
    '.....AAAAAAAA.....',
    '.....BBBBBBBB.....',
    '.....BBBBBBBB.....',
  ],
  [ // crown
    '',
    '',
    '.....g..gg..g.....',
    '.....gg.gg.gg.....',
    '.....grgbbgrg.....',
    '.....gggggggg.....',
  ],
  [ // wizard hat
    '..........vv......',
    '.........vv.......',
    '........vvv.......',
    '.......vgvv.......',
    '......vvvvvv......',
    '...vvvvvvvvvvvv...',
  ],
  [ // chef hat
    '......wwwwww......',
    '....wwwwwwwwww....',
    '....wwwwwwwwww....',
    '.....wwwwwwww.....',
    '......wswsws......',
    '......wwwwww......',
  ],
  [ // viking helmet
    '',
    '..w............w..',
    '..ww..........ww..',
    '...ww.ssssss.ww...',
    '....wssssssssw....',
    '.....ssssssss.....',
    '.....dddssddd.....',
    '........ss........',
  ],
  [ // sombrero
    '',
    '.......yyyy.......',
    '......yyyyyy......',
    '......rrrrrr......',
    'y.....yyyyyy.....y',
    'yyyyyyyyyyyyyyyyyy',
  ],
  [ // headband
    '',
    '',
    '',
    '',
    '',
    '.....rrrrrrrr.....',
    '.............rr...',
    '..............r...',
  ],
  [ // propeller cap
    '.....rrrkkbbb.....',
    '........kk........',
    '......rrggbb......',
    '.....rrrggbbb.....',
    '.....rrrggbbb.....',
  ],
  [ // fez
    '',
    '.......rrrrk......',
    '.......rrrr.k.....',
    '......rrrrrrk.....',
    '......rrrrrr......',
  ],
  [ // bunny ears
    '......ww..ww......',
    '......wp..pw......',
    '......wp..pw......',
    '......ww..ww......',
  ],
  [ // santa hat
    '',
    '.........rrr......',
    '.......rrrrrr.....',
    '......rrrrrrrww...',
    '......rrrrrr.ww...',
    '.....wwwwwwww.....',
  ],
  [ // boater
    '',
    '',
    '',
    '......yyyyyy......',
    '......nnnnnn......',
    '...yyyyyyyyyyyy...',
  ],
  [ // halo
    '......gggggg......',
    '.....g......g.....',
    '......gggggg......',
  ],
  [ // pirate hat
    '',
    '.......kkkk.......',
    '.....kkkkkkkk.....',
    '....kkkkwwkkkk....',
    '...kkkkkkkkkkkk...',
    '..gggggggggggggg..',
  ],
]

const INK: Record<string, string> = {
  k: '#26262d', w: '#f5f1e6', r: '#e8243c', b: '#2f6bff', g: '#ffd21f', v: '#9a4dff', s: '#a0a5af', d: '#6a6f7a',
  y: '#e6c067', h: '#8a5a2b', n: '#3a2412', p: '#ff6fb5', c: '#9fe3f0',
}

const SKINS = ['#f8d8c0', '#f0b98d', '#d99a6c', '#b5754a', '#8d5a34', '#6b4226']
const HAIRS = ['#16161a', '#4a2816', '#8a5a2b', '#e6c067', '#c4541a', '#c4c8d0', '#ff6fb5', '#2f6bff']
// The top: [main, second]. The sleeves have the second color.
const TOPS = [
  ['#2f6bff', '#ffd21f'], ['#f5f1e6', '#e8243c'], ['#12a150', '#ffd21f'], ['#9a4dff', '#f5f1e6'],
  ['#ffd21f', '#16161a'], ['#e8243c', '#f5f1e6'], ['#12c4d1', '#16161a'], ['#ff6fb5', '#2f6bff'],
  ['#a8e000', '#16161a'], ['#ff6200', '#f5f1e6'], ['#26262d', '#ff6200'], ['#f5f1e6', '#2f6bff'],
]
const PANTS = ['#f5f1e6', '#26262d', '#2f4a8a', '#8a5a2b', '#e8243c', '#12a150', '#ffd21f', '#c4c8d0']

// Where the top has its second color: plain, hoops, stripes, sash, halves, checks, braces, badge.
// The top is the columns 6 to 11 of the rows 11 to 14.
const PATTERNS: ((x: number, y: number) => boolean)[] = [
  () => false,
  (_x, y) => y % 2 === 0,
  (x) => x % 2 === 0,
  (x, y) => x - y === -5 || x - y === -4,
  (x) => x < 9,
  (x, y) => ((x >> 1) + ((y + 1) >> 1)) % 2 === 0,
  (x) => x === 7 || x === 10,
  (x, y) => (x === 8 || x === 9) && (y === 12 || y === 13),
]

// The parts that a player picks. The database keeps one number per part in this order (players.rider), so add a
// new part at the end.
export const PARTS = [
  { name: 'Body', count: BODIES.length },
  { name: 'Skin', count: SKINS.length },
  { name: 'Hair', count: HAIRS.length },
  { name: 'Hat', count: HATS.length },
  { name: 'Top', count: TOPS.length },
  { name: 'Pattern', count: PATTERNS.length },
  { name: 'Pants', count: PANTS.length },
]

// The rider of a player, with each number inside its list. A player who built no rider gets one from the player
// id, and the same id always gives the same rider.
export function riderOf({ id, rider }: Pick<Player, 'id' | 'rider'>) {
  let n = 2166136261
  return PARTS.map((part, i) => {
    for (let c = 0; c < id.length; c++) n = Math.imul(n ^ id.charCodeAt(c), 16777619) >>> 0
    return (rider?.[i] ?? n) % part.count
  })
}

// A rider from riderOf as a grid of colors. null is transparent.
export function drawRider([body, skin, hair, hat, top, pattern, pants]: number[]): (string | null)[][] {
  const [main, second] = TOPS[top]
  const colors: Record<string, string> = {
    ...INK, F: SKINS[skin], M: HAIRS[hair], E: '#000000', A: main, B: second, P: PANTS[pants], T: '#2a1a10',
  }
  const grid: (string | null)[][] = Array.from({ length: RIDER_H }, () => Array(RIDER_W).fill(null))
  const paint = (rows: string[], first: number) =>
    rows.forEach((row, y) =>
      [...row].forEach((key, x) => {
        if (key === '.') return
        grid[first + y + 1][x + 1] = key === 'J' ? (PATTERNS[pattern](x, first + y) ? second : main) : colors[key]
      }),
    )
  paint(BODIES[body], 4)
  paint(HATS[hat], 0)
  return outline(grid)
}
