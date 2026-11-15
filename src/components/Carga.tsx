import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { SHOT, torre } from '@/lib/estado'

/** Mínimo en pantalla. Si la descarga tarda más, espera a que termine (hasta TOPE). */
const MINIMO = 2000
const TOPE = 20000
const SUAVE = [0.22, 0.7, 0.18, 1] as const

type Parte = 'portada' | 'vuelo' | 'residencia'
const PESO: Record<Parte, number> = { portada: 0.06, vuelo: 0.3, residencia: 0.64 }

/**
 * Pantalla de carga. Debajo de ella la página YA está montada y descargando de verdad:
 * la imagen de la portada, los 98 cuadros del vuelo y el departamento 3D (modelo + texturas).
 * El contador es ese avance real; al llegar a 100 la portada hace su entrada (torre.revelar).
 */
export function Carga({ partes }: { partes: Parte[] }) {
  const [visible, setVisible] = useState(!SHOT)
  const [pct, setPct] = useState(0)
  const portada = useRef(0)

  useEffect(() => {
    if (!visible) return
    if (partes.includes('portada')) {
      const i = new Image()
      i.src = '/img/portada.webp'
      const fin = () => (portada.current = 1)
      i.decode().then(fin, fin)
    }
    let fuentes = false
    ;(document.fonts?.ready ?? Promise.resolve()).then(() => (fuentes = true))

    const total = partes.reduce((s, p) => s + PESO[p], 0)
    const t0 = performance.now()
    let mostrado = 0
    let raf = 0
    const paso = (t: number) => {
      const dt = t - t0
      const e = torre.get()
      const avance: Record<Parte, number> = { portada: portada.current, vuelo: e.cargaVuelo, residencia: e.cargaResidencia }
      const real = partes.reduce((s, p) => s + PESO[p] * avance[p], 0) / total
      const completo = real >= 0.999 && fuentes
      const fin = dt >= MINIMO && (completo || dt > TOPE)
      // nunca va más rápido que el reloj (mínimo 2 s) ni que la descarga real
      const reloj = 1 - Math.pow(1 - Math.min(1, dt / MINIMO), 2.2)
      const objetivo = fin ? 100 : Math.min(99, Math.min(reloj, real) * 100)
      mostrado = Math.max(mostrado, mostrado + (objetivo - mostrado) * 0.18)
      setPct(fin ? 100 : Math.round(mostrado))
      if (!fin) raf = requestAnimationFrame(paso)
      else {
        setVisible(false)
        torre.revelar()
      }
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="carga"
          role="status"
          aria-label="Cargando"
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.9, ease: SUAVE }}
          className="fixed inset-0 z-[100] grid place-items-center bg-noche text-ink"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(60% 45% at 50% 55%, color-mix(in srgb, var(--color-oro) 9%, transparent), transparent 70%)',
            }}
          />

          <div className="relative flex flex-col items-center">
            <motion.svg
              viewBox="0 0 18 22"
              className="h-14 w-[46px] text-oro"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: SUAVE }}
              aria-hidden
            >
              <g fill="none" stroke="currentColor" strokeWidth="0.7">
                <motion.rect
                  x="1" y="1" width="16" height="20" rx="0.8"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.4, ease: SUAVE }}
                />
                <motion.path
                  d="M7 21V1M11 21V1"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.1, delay: 0.35, ease: SUAVE }}
                />
              </g>
            </motion.svg>

            <motion.span
              className="font-ancha mt-8 pl-[0.6em] text-[22px] font-medium tracking-[0.6em]"
              initial={{ opacity: 0, letterSpacing: '0.9em' }}
              animate={{ opacity: 1, letterSpacing: '0.6em' }}
              transition={{ duration: 1.3, delay: 0.15, ease: SUAVE }}
            >
              CEIBA
            </motion.span>

            <motion.span
              className="etiqueta mt-4 text-ink/45"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
            >
              Residencias sobre el parque
            </motion.span>

            <div className="mt-12 h-px w-[min(240px,56vw)] overflow-hidden bg-white/12">
              <div className="h-full origin-left bg-oro" style={{ transform: `scaleX(${pct / 100})` }} />
            </div>
            <span className="etiqueta mt-4 tabular-nums text-ink/55">{String(pct).padStart(3, '0')}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
