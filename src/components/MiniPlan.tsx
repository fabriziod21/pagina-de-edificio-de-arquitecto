import { cn } from '@/lib/utils'

// Esquema de la planta del nivel como en la ficha del original: una grilla
// simple de unidades, con las disponibles resaltadas.
const W = 120
const H = 74
const G = 3 // separación entre unidades

type Rect = { x: number; y: number; w: number; h: number }

function unidades(porNivel: number): Rect[] {
  const mx = (W - G) / 2
  const my = (H - G) / 2
  switch (porNivel) {
    case 4:
      return [
        { x: 0, y: my + G, w: mx, h: my },
        { x: mx + G, y: my + G, w: mx, h: my },
        { x: 0, y: 0, w: mx, h: my },
        { x: mx + G, y: 0, w: mx, h: my },
      ]
    case 3:
      return [
        { x: 0, y: my + G, w: mx, h: my },
        { x: mx + G, y: my + G, w: mx, h: my },
        { x: 0, y: 0, w: W, h: my },
      ]
    case 2:
      return [
        { x: 0, y: 0, w: mx, h: H },
        { x: mx + G, y: 0, w: mx, h: H },
      ]
    default:
      return [{ x: 0, y: 0, w: W, h: H }]
  }
}

export function MiniPlan({ porNivel, libres, className }: { porNivel: number; libres: number[]; className?: string }) {
  return (
    <svg viewBox={`-1 -1 ${W + 2} ${H + 2}`} className={cn('block', className)} role="img" aria-label="Unidades del nivel">
      {unidades(porNivel).map((u, i) => {
        const libre = libres.includes(i)
        return (
          <rect
            key={i}
            x={u.x}
            y={u.y}
            width={u.w}
            height={u.h}
            className="transition-[fill] duration-500"
            fill={libre ? 'rgba(214,214,198,.78)' : 'rgba(255,255,255,.04)'}
            stroke="rgba(255,255,255,.38)"
            strokeWidth="1"
          />
        )
      })}
    </svg>
  )
}
