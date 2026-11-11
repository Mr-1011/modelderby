import type { CSSProperties } from 'react'
import { drawFrame, FRAMES, lookOf, SPRITE_H, SPRITE_W } from '../lib/sprite'

// One sprite sheet per horse, drawn once: the frames side by side.
const sheets = new Map<string, string>()

function sheet(id: string) {
  let url = sheets.get(id)
  if (!url) {
    const canvas = document.createElement('canvas')
    canvas.width = SPRITE_W * FRAMES
    canvas.height = SPRITE_H
    const ctx = canvas.getContext('2d')!
    const look = lookOf(id)
    for (let frame = 0; frame < FRAMES; frame++)
      drawFrame(look, frame).forEach((line, y) =>
        line.forEach((color, x) => {
          if (!color) return
          ctx.fillStyle = color
          ctx.fillRect(frame * SPRITE_W + x, y, 1, 1)
        }),
      )
    url = canvas.toDataURL()
    sheets.set(id, url)
  }
  return url
}

// scale is the size of one sprite pixel in CSS pixels. Use a whole number, so the pixels stay sharp.
// With idle, a horse that stands lifts its legs now and then. Each horse has its own rhythm, from its id.
export default function Horse({
  id, scale, running = false, idle = false,
}: {
  id: string; scale: number; running?: boolean; idle?: boolean
}) {
  const beat = [...id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 4001, 7)
  return (
    <div
      aria-hidden
      className={`shrink-0 bg-no-repeat [image-rendering:pixelated] ${running ? 'motion-safe:animate-gallop' : idle ? 'motion-safe:animate-idle' : ''}`}
      style={
        {
          width: SPRITE_W * scale,
          height: SPRITE_H * scale,
          backgroundImage: `url(${sheet(id)})`,
          backgroundSize: `${SPRITE_W * FRAMES * scale}px ${SPRITE_H * scale}px`,
          '--sprite-w': `${SPRITE_W * scale}px`,
          ...(idle && !running && { animationDuration: `${3000 + beat}ms`, animationDelay: `-${beat}ms` }),
        } as CSSProperties
      }
    />
  )
}
