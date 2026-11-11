import { drawRider, RIDER_H, RIDER_W } from '../lib/rider'

// The rider of a player. rider comes from riderOf. scale is the size of one sprite pixel in CSS pixels.
export default function Rider({ rider, scale }: { rider: number[]; scale: number }) {
  return (
    <svg
      width={RIDER_W * scale}
      height={RIDER_H * scale}
      viewBox={`0 0 ${RIDER_W} ${RIDER_H}`}
      shapeRendering="crispEdges"
      aria-hidden
      className="block shrink-0"
    >
      {drawRider(rider).flatMap((line, y) =>
        line.map((color, x) => color && <rect key={`${x} ${y}`} x={x} y={y} width={1} height={1} fill={color} />),
      )}
    </svg>
  )
}
