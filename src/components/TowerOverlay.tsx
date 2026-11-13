import { useEffect, useRef } from 'react'
import { FACHADA, RENDER, TOTAL_NIVELES, franja } from '@/data/torre'
import { anclas, torre, useTorre } from '@/lib/estado'

const MARGEN = 64 // cuánto se extiende la franja de luz fuera de la fachada (px del render)
const MOV = 'transform .55s cubic-bezier(.22,.7,.18,1), opacity .5s'

/**
 * Capa SVG con las mismas coordenadas del render (1920×1080) y el mismo
 * recorte que la imagen (object-cover ⇔ xMidYMid slice): cada nivel cae
 * exactamente sobre su franja de la fachada a cualquier tamaño de pantalla.
 */
export function TowerOverlay() {
  const { activo, visible } = useTorre()
  const anclaRef = useRef<SVGCircleElement>(null)
  const f = franja(activo)

  // publica la posición en pantalla del extremo de la franja (para la línea hacia la ficha)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const el = anclaRef.current
      const sec = el?.ownerSVGElement?.parentElement?.getBoundingClientRect()
      if (el && sec) {
        const r = el.getBoundingClientRect()
        anclas.banda.x = r.left + r.width / 2 - sec.left
        anclas.banda.y = r.top + r.height / 2 - sec.top
        anclas.banda.ok = torre.get().visible
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <svg viewBox={`0 0 ${RENDER.w} ${RENDER.h}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
      <defs>
        <linearGradient id="banda" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.2" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.8" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="filo" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.25" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="0.75" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="halo" x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      {/* franja del nivel activo */}
      <g style={{ transform: `translateY(${f.y}px)`, transition: MOV, opacity: visible ? 1 : 0 }} pointerEvents="none">
        <rect x={f.x - MARGEN} y={-6} width={f.w + MARGEN * 2} height={f.h + 12} fill="#fff" opacity="0.18" filter="url(#halo)" />
        <rect x={f.x - MARGEN} y={0} width={f.w + MARGEN * 2} height={f.h} fill="url(#banda)" />
        <rect x={f.x - MARGEN} y={0} width={f.w + MARGEN * 2} height={1.2} fill="url(#filo)" />
        <rect x={f.x - MARGEN} y={f.h - 1.2} width={f.w + MARGEN * 2} height={1.2} fill="url(#filo)" />
        <circle ref={anclaRef} cx={f.x + f.w + MARGEN + 6} cy={f.h / 2} r="3" fill="#fff" />
      </g>

      {/* número del nivel a la izquierda de la torre */}
      <g style={{ transform: `translateY(${f.y + f.h / 2}px)`, transition: MOV, opacity: visible ? 1 : 0 }} pointerEvents="none">
        <text x={FACHADA.x - MARGEN - 18} y={6} textAnchor="end" className="font-ancha" fill="#fff" fontSize="30" fontWeight="300">
          {String(activo).padStart(2, '0')}
        </text>
        <text x={FACHADA.x - MARGEN - 18} y={24} textAnchor="end" className="font-ancha" fill="#fff" fillOpacity="0.6" fontSize="9" letterSpacing="3">
          NIVEL
        </text>
      </g>

      {/* zonas sensibles: una por nivel, algo más anchas que la fachada */}
      {Array.from({ length: TOTAL_NIVELES }, (_, i) => {
        const r = franja(i + 1)
        return (
          <rect
            key={i}
            x={r.x - 24}
            y={r.y}
            width={r.w + 48}
            height={r.h}
            fill="transparent"
            className="cursor-pointer"
            onPointerEnter={() => torre.ir(i + 1)}
            onClick={() => torre.ir(i + 1)}
            aria-label={`Nivel ${i + 1}`}
          />
        )
      })}
    </svg>
  )
}
