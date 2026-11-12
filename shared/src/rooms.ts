// The one list of the challenges. The key is the name of the room: the folder in pool/, the folder on the Archil
// disk and races.task. The order is the order that new races take.
//
// To add a challenge:
// 1. Make pool/<room>/ with setup.py, check.sh and solve.py, and push it: node --env-file=.env src/prepare.ts <room>
// 2. Add one entry here. The runner opens races only for a room that is here and on the disk.
// 3. Draw its image in frontend/src/components/Glyph.tsx. Without one, the image is generated from the name.
//
// Each room has 3 levels: setup.py --level 1 is the easy room, 3 the hard one. The runner picks a level for each
// race. The screens show no level and no category: the blurb of the level names the size of the job.
//
// All of this is public. The task, the checker and the answers stay in pool/.
export type Room = {
  title: string
  category: string // one word for the kind of work, for us: the screens do not show it
  blurbs: [string, string, string] // the one public line about the challenge, for the levels 1, 2 and 3
  search?: true // the room has the command `search`, and the runner answers it with a web search
}

export const ROOMS: Record<string, Room> = {
  cube: {
    title: 'The Cube',
    category: 'puzzle',
    blurbs: [
      "A scrambled Rubik's cube. The models solve it with a command line tool.",
      "A scrambled Rubik's cube. The models solve it with a command line tool.",
      "A scrambled Rubik's cube. The models solve it with a command line tool.",
    ],
  },
  papertrail: {
    title: 'Paper Trail',
    category: 'research',
    blurbs: [
      'The models search the web: 4 chained questions, then one final number.',
      'The models search the web: 4 chained questions, then one final number.',
      'The models search the web: 4 chained questions, then one final number.',
    ],
    search: true,
  },
  blackbox: {
    title: 'Black Box',
    category: 'reverse',
    blurbs: [
      'A program with no source. Five layers. One password.',
      'A program with no source. Five layers. One password.',
      'A program with no source. Five layers. One password.',
    ],
  },
  rover: {
    title: 'Lost Rover',
    category: 'robotics',
    blurbs: [
      'A rover in a warehouse. It must deliver one package before the battery is empty.',
      'A rover in a warehouse. It must deliver one package before the battery is empty.',
      'A rover in a warehouse. It must deliver one package before the battery is empty.',
    ],
  },
  bughunt: {
    title: 'Bug Hunt',
    category: 'code',
    blurbs: [
      'Five bugs. No hints. The tests are hidden.',
      'Five bugs. No hints. The tests are hidden.',
      'Five bugs. No hints. The tests are hidden.',
    ],
  },
  vault: {
    title: 'The Vault',
    category: 'escape',
    blurbs: [
      'An escape room with 5 locks: server logs, a cipher, a bug, a grid puzzle and a map.',
      'An escape room with 5 locks: server logs, a cipher, a bug, a grid puzzle and a map.',
      'An escape room with 5 locks: server logs, a cipher, a bug, a grid puzzle and a map.',
    ],
  },
  slowlane: {
    title: 'Slow Lane',
    category: 'code',
    blurbs: [
      'It works. It is slow. Make it ten times faster.',
      'It works. It is slow. Make it ten times faster.',
      'It works. It is slow. Make it ten times faster.',
    ],
  },
  coldcase: {
    title: 'Cold Case',
    category: 'research',
    blurbs: [
      'Thirty log entries. Five are forged. Find them.',
      'Thirty log entries. Five are forged. Find them.',
      'Thirty log entries. Five are forged. Find them.',
    ],
    search: true,
  },
  thepatch: {
    title: 'The Patch',
    category: 'code',
    blurbs: [
      'The library changed. The code did not. Make the tests pass.',
      'The library changed. The code did not. Make the tests pass.',
      'The library changed. The code did not. Make the tests pass.',
    ],
    search: true,
  },
}

// The public line of a race: the blurb of its room at its level.
export const blurbOf = (task: string, level: number) => ROOMS[task]?.blurbs[level - 1]
