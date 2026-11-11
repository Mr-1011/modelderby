import type { ReactNode } from 'react'
import Horse from './Horse'
import { grass } from './Track'

// An empty list: one horse that waits on the meadow, and one line.
export default function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 border-2 border-line bg-panel">
      <div className="flex justify-center pb-1 pt-5" style={grass(2)}>
        <Horse id="h1" scale={2} idle />
      </div>
      <p className="p-4 text-center font-pixel text-[30px] leading-none text-muted">{children}</p>
    </div>
  )
}
