import { ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { ALTURA_M, TOTAL_DISPONIBLES, TOTAL_NIVELES, TOTAL_RESIDENCIAS } from '@/data/torre'
import { anclas, SHOT, torre, useTorre } from '@/lib/estado'
import { LevelCard } from './LevelCard'
import { Residencia } from './Residencia'
import { TowerOverlay } from './TowerOverlay'
import { Vuelo } from './Vuelo'

const EASE = [0.22, 0.7, 0.18, 1] as const
const INICIAL = 18

export function Hero() {
  const { entrada } = useTorre()
  // barrido de entrada: la franja sube del nivel 1 al 18 (cuando termina la pantalla de carga)
  useEffect(() => {
    if (SHOT || !entrada) return
    const timers: number[] = []
    timers.push(window.setTimeout(() => torre.mostrar(), 1400))
    for (let n = 2; n <= INICIAL; n++) {
      timers.push(
        window.setTimeout(() => {
          if (!torre.get().tocado) torre.ir(n, false)
        }, 1400 + (n - 1) * 55),
      )
    }
    return () => timers.forEach(clearTimeout)
  }, [entrada])

  // flechas del teclado (solo en la portada; dentro del departamento las usa el recorrido)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      if (torre.get().modo !== 'torre') return
      if (window.scrollY > window.innerHeight * 0.6) return
      e.preventDefault()
      torre.ir(torre.get().activo + (e.key === 'ArrowUp' ? 1 : -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // scroll hacia abajo en la portada = entrar volando a la residencia (como "Explorar residencias")
  useEffect(() => {
    let acumulado = 0
    let ultimo = 0
    // al volver a la portada, la inercia de la rueda no debe relanzar el vuelo
    let previo = torre.get().modo
    let enTorreDesde = 0
    const unsub = torre.subscribe(() => {
      const m = torre.get().modo
      if (m !== previo && m === 'torre') enTorreDesde = performance.now()
      previo = m
    })
    const onWheel = (e: WheelEvent) => {
      if (torre.get().modo !== 'torre') return
      const ahora = performance.now()
      if (ahora - enTorreDesde < 1200) return
      if (ahora - ultimo > 400) acumulado = 0
      ultimo = ahora
      acumulado += e.deltaY * (e.deltaMode === 1 ? 40 : 1)
      if (acumulado > 90) {
        acumulado = 0
        torre.entrar()
      }
    }
    // en pantallas táctiles: deslizar hacia arriba
    let y0: number | null = null
    const onTouchStart = (e: TouchEvent) => (y0 = e.touches[0]?.clientY ?? null)
    const onTouchMove = (e: TouchEvent) => {
      if (y0 === null || torre.get().modo !== 'torre') return
      if (y0 - (e.touches[0]?.clientY ?? y0) > 70) {
        y0 = null
        torre.entrar()
      }
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      unsub()
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  return (
    <section className="relative h-svh min-h-[660px] overflow-hidden bg-noche">
      {/* render de Cycles + capa interactiva con su mismo recorte */}
      <motion.div
        initial={SHOT ? false : { scale: 1.08, opacity: 0 }}
        animate={entrada ? { scale: 1, opacity: 1 } : { scale: 1.08, opacity: 0 }}
        transition={{ duration: 2.4, ease: EASE }}
        className="absolute inset-0"
      >
        <img
          src="/img/portada.webp"
          alt="Torre Ceiba al atardecer, con su atrio dorado, sobre el parque"
          className="absolute inset-0 size-full object-cover"
        />
      </motion.div>

      {/* vuelo pre-renderizado (encima de la portada) y llegada al departamento 3D */}
      <Vuelo />
      <ResidenciaEnTorre />

      {/* interfaz de la portada: se desvanece mientras volamos */}
      <InterfazTorre>
        {/* velos para leer el texto (no capturan el mouse: la torre sigue siendo interactiva) */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,10,15,.55)_0%,rgba(8,10,15,.2)_28%,rgba(8,10,15,0)_42%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/70 to-transparent" />

        <motion.div
          initial={SHOT ? false : { scale: 1.08 }}
          animate={{ scale: entrada ? 1 : 1.08 }}
          transition={{ duration: 2.4, ease: EASE }}
          className="absolute inset-0"
        >
          <TowerOverlay />
        </motion.div>
        <Copy />
        <Cifras />
        <FichaConLinea />
      </InterfazTorre>
    </section>
  )
}

/**
 * El departamento 3D se monta apenas empieza el vuelo (así carga mientras volamos)
 * y aparece al llegar. Al volver a la torre se desvanece y se desmonta.
 */
function ResidenciaEnTorre() {
  const { modo } = useTorre()
  // se monta (y carga, en pausa) desde que se abre la página, debajo de la pantalla de carga:
  // al pulsar "Explorar" el 3D ya está listo y el vuelo no compite con su descarga
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <Residencia activa={modo === 'nivel'} onSalir={() => torre.salir()} />
    </div>
  )
}

function InterfazTorre({ children }: { children: React.ReactNode }) {
  const { modo } = useTorre()
  const en = modo === 'torre'
  return (
    <div
      className="absolute inset-0 z-10 transition-opacity duration-500"
      style={{ opacity: en ? 1 : 0, pointerEvents: en ? 'auto' : 'none' }}
      aria-hidden={!en}
    >
      {children}
    </div>
  )
}

/* ---------------------------------------------------- ficha + conector */

function FichaConLinea() {
  const { activo, direccion, visible } = useTorre()
  const cardRef = useRef<HTMLDivElement>(null)
  const lineaRef = useRef<SVGPolylineElement>(null)
  const puntoRef = useRef<SVGCircleElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const c = cardRef.current?.getBoundingClientRect()
      const s = svgRef.current?.getBoundingClientRect()
      const a = anclas.banda
      if (c && s && lineaRef.current && puntoRef.current) {
        const x2 = c.left - s.left
        const y2 = c.top + 96 - s.top
        const ok = window.innerWidth >= 1024 && a.ok
        lineaRef.current.setAttribute('points', `${a.x},${a.y} ${a.x + 26},${a.y} ${x2 - 18},${y2} ${x2},${y2}`)
        puntoRef.current.setAttribute('cx', String(x2))
        puntoRef.current.setAttribute('cy', String(y2))
        svgRef.current!.style.opacity = ok ? '1' : '0'
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      <svg ref={svgRef} className="pointer-events-none absolute inset-0 z-10 size-full transition-opacity duration-500" style={{ opacity: 0 }}>
        <polyline ref={lineaRef} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1" />
        <circle ref={puntoRef} r="2.5" fill="#fff" />
      </svg>
      <motion.div
        initial={SHOT ? false : { opacity: 0, x: 24 }}
        animate={{ opacity: visible ? 1 : 0, x: visible ? 0 : 24 }}
        transition={{ duration: 0.9, ease: EASE }}
        className="absolute right-[4vw] bottom-28 z-20 lg:top-[31%] lg:bottom-auto"
      >
        <LevelCard ref={cardRef} activo={activo} direccion={direccion} onCambiar={(n) => torre.ir(n)} />
      </motion.div>
    </>
  )
}

/* ----------------------------------------------------------- texto */

function Copy() {
  const { entrada } = useTorre()
  const item = (d: number) => ({
    initial: SHOT ? false : { opacity: 0, y: 22 },
    animate: entrada ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 },
    transition: { duration: 1.1, delay: d, ease: EASE },
  })
  return (
    <div className="pointer-events-none absolute top-[24vh] left-[4vw] z-10 max-w-[560px] text-ink">
      <motion.p {...item(0.5)} className="etiqueta inline-flex items-center gap-3 text-white/80">
        <span className="size-1.5 rounded-full bg-oro shadow-[0_0_10px_var(--color-oro)]" />
        Distrito Parque — En venta
      </motion.p>
      <h1 className="font-ancha mt-6 text-[clamp(2.6rem,5.6vw,5.4rem)] leading-[0.98] tracking-[-0.01em] uppercase">
        <motion.span {...item(0.65)} className="block font-light">
          Vivir
        </motion.span>
        <motion.span {...item(0.78)} className="block font-light">
          Sobre el
        </motion.span>
        <motion.span {...item(0.91)} className="block font-extralight text-white/88">
          Parque
        </motion.span>
      </h1>
      <motion.p {...item(1.1)} className="mt-6 max-w-[330px] text-[15px] leading-relaxed text-white/75">
        Veintiséis niveles alrededor de un atrio dorado. {TOTAL_RESIDENCIAS} residencias, todas con vista al verde.
      </motion.p>
      <motion.div {...item(1.25)} className="pointer-events-auto mt-8 flex flex-wrap gap-3">
        <a
          href="#residencias"
          onClick={(e) => {
            e.preventDefault()
            torre.entrar()
          }}
          className="etiqueta group inline-flex items-center gap-2.5 rounded-full bg-white/90 px-6 py-3.5 text-noche transition-colors hover:bg-white"
        >
          Explorar residencias
          <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
        <a
          href="#contacto"
          className="etiqueta vidrio inline-flex items-center rounded-full px-6 py-3.5 text-ink transition-colors hover:bg-white/10"
        >
          Agendar visita
        </a>
      </motion.div>
    </div>
  )
}

function Cifras() {
  const { entrada } = useTorre()
  const datos: [string, string, string?][] = [
    [String(TOTAL_NIVELES), 'Niveles'],
    [String(TOTAL_RESIDENCIAS), 'Residencias'],
    [String(ALTURA_M), 'Altura', 'm'],
    [String(TOTAL_DISPONIBLES), 'Disponibles'],
  ]
  return (
    <motion.dl
      initial={SHOT ? false : { opacity: 0, y: 16 }}
      animate={entrada ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 1.1, delay: 1.5, ease: EASE }}
      className="pointer-events-none absolute bottom-8 left-[4vw] z-10 flex text-ink"
    >
      {datos.map(([v, k, u], i) => (
        <div key={k} className={i > 0 ? 'border-l border-white/20 pl-5 sm:pl-7' : ''} style={{ paddingRight: 24 }}>
          <dd className="font-ancha text-[26px] leading-none font-light sm:text-[30px]">
            {v}
            {u && <span className="ml-0.5 text-[13px] text-white/70">{u}</span>}
          </dd>
          <dt className="etiqueta mt-2 !text-[9px] text-white/55">{k}</dt>
        </div>
      ))}
    </motion.dl>
  )
}
