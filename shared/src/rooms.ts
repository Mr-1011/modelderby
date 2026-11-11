// The one list of the challenges. The key is the name of the room: the folder in pool/, the folder on the Archil
// disk and races.task. The order is the order that new races take.
//
// To add a challenge:
// 1. Make pool/<room>/ with setup.py, check.sh and solve.py, and push it: node --env-file=.env src/prepare.ts <room>
// 2. Add one entry here. The runner opens races only for a room that is here and on the disk.
// 3. Draw its image in frontend/src/components/Glyph.tsx. Without one, the image is generated from the name.
//
// All of this is public. The task, the checker and the answers stay in pool/.
export type Room = {
  title: string
  category: string // one word for the kind of work
  blurb: string // the one public line about the challenge
  search?: true // the room has the command `search`, and the runner answers it with a web search
}

export const ROOMS: Record<string, Room> = {
  cube: { title: 'The Cube', category: 'puzzle', blurb: "A scrambled Rubik's cube. The models solve it with a command line tool." },
  papertrail: { title: 'Paper Trail', category: 'research', blurb: 'The models search the web: 4 chained questions, then one final number.', search: true },
  blackbox: { title: 'Black Box', category: 'reverse', blurb: 'A program with no source. Five layers. One password.' },
  rover: { title: 'Lost Rover', category: 'robotics', blurb: 'A rover in a warehouse. It must deliver one package before the battery is empty.' },
  bughunt: { title: 'Bug Hunt', category: 'code', blurb: 'Five bugs. No hints. The tests are hidden.' },
  vault: { title: 'The Vault', category: 'escape', blurb: 'An escape room with 5 locks: server logs, a cipher, a bug, a grid puzzle and a map.' },
  slowlane: { title: 'Slow Lane', category: 'code', blurb: 'It works. It is slow. Make it ten times faster.' },
}
