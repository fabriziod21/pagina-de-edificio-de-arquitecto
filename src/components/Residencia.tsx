import { ArrowLeft, ArrowRight, LayoutGrid, Mouse } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { PARADAS } from '@/residencia/paradas'
import { crearResidencia, type Residencia as Api } from '@/residencia/escena'
import { torre } from '@/lib/estado'

const EASE = [0.22, 0.7, 0.18, 1] as const

type Props = {
  /** false: se precarga en silencio (pausada); true: se ve y entra por el ventanal */
  activa?: boolean
  onSalir?: () => void
}

/** Residencia 18.03 en 3D con luz horneada: recorrido por ambientes + vista en planta. */
export function Residencia({ activa = true, onSalir }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const api = useRef<Api | null>(null)
  const [progreso, setProgreso] = useState(0)
  const [listo, setListo] = useState(false)
  const [parada, setParada] = useState<number | null>(null)
  const [enPlanta, setEnPlanta] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  // el aviso de scroll se va en cuanto el usuario avanza por primera vez
  const [movido, setMovido] = useState(false)
  const movidoRef = useRef(false)
  const riel = useRef<HTMLDivElement>(null)
  const salirRef = useRef<() => void>(() => {})

  useEffect(() => {
    const r = crearResidencia(canvas.current!, {
      onProgreso: setProgreso,
      onListo: () => {
        setListo(true)
        torre.setResidenciaLista(true)
      },
      onParada: setParada,
      // en cada cuadro: se escribe directo en el estilo, sin re-render
      onAvance: (a) => {
        riel.current?.style.setProperty('--avance', a.toFixed(4))
        if (a > 0.02 && !movidoRef.current) {
          movidoRef.current = true
          setMovido(true)
        }
      },
      onVolver: () => salirRef.current(),
    })
    api.current = r
    return () => r.dispose()
  }, [])

  // al activarse (fin del vuelo) aparece en la misma pose del último cuadro; al desactivarse se pausa
  useEffect(() => {
    const r = api.current
    if (!r) return
    r.setActiva(activa && listo)
    if (!activa || !listo) return
    setEnPlanta(false)
    r.llegar()
  }, [activa, listo])

  // volver a la torre: primero a la vista de la sala (donde empieza el vuelo de regreso)
  const salir = async () => {
    if (!api.current || ocupado || !onSalir) return
    setOcupado(true)
    await api.current.volverAlInicio()
    setEnPlanta(false)
    setOcupado(false)
    onSalir()
  }
  useEffect(() => {
    salirRef.current = salir
  })

  const ir = async (i: number) => {
    if (!api.current || ocupado) return
    setOcupado(true)
    await api.current.irA(Math.max(0, Math.min(PARADAS.length - 1, i)))
    setEnPlanta(false)
    setOcupado(false)
  }
  const verPlanta = async () => {
    if (!api.current || ocupado) return
    setOcupado(true)
    await api.current.planta()
    setEnPlanta(true)
    setOcupado(false)
  }

  const p = parada !== null ? PARADAS[parada] : null

  return (
    <>
    {!listo && activa && (
      <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
        <p className="etiqueta vidrio rounded-full px-5 py-2.5 text-white/80">Cargando residencia · {Math.round(progreso * 100)}%</p>
      </div>
    )}
    <div
      className="absolute inset-0 transition-opacity duration-700"
      style={{
        opacity: activa && listo ? 1 : 0,
        pointerEvents: activa && listo ? 'auto' : 'none',
        // fondo de la vista en planta: el mismo atardecer oscuro de la página
        background: 'radial-gradient(120% 90% at 50% 38%, #3a2d26 0%, #1a1719 45%, #0b0d12 85%)',
      }}
      aria-hidden={!activa}
    >
      <canvas ref={canvas} className="absolute inset-0 size-full touch-none" />
      {/* velo superior para que el menú se lea sobre el cielo raso claro */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/40 to-transparent" />

      {/* volver a la torre (siempre a mano, arriba a la izquierda) */}
      {onSalir && (
        <button
          type="button"
          onClick={salir}
          disabled={ocupado}
          className="etiqueta vidrio absolute top-[112px] left-[4vw] z-10 inline-flex items-center gap-2 rounded-full px-4 py-2.5 !text-[10px] text-ink transition-colors hover:bg-white/15 disabled:opacity-40"
        >
          <ArrowLeft className="size-3.5" /> Volver a la torre
        </button>
      )}

      {/* vista en planta: título y acceso a cada ambiente */}
      <AnimatePresence>
        {enPlanta && !ocupado && (
          <motion.div
            key="planta"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="pointer-events-none absolute inset-0 text-ink"
          >
            <div className="absolute top-[108px] left-1/2 -translate-x-1/2 text-center">
              <p className="etiqueta text-white/55">Torre Ceiba — Residencia 18.03</p>
              <h2 className="font-ancha mt-3 text-[clamp(2rem,3.4vw,3rem)] leading-none font-light">Nivel 18</h2>
              <p className="etiqueta mt-3 !text-[10px] text-white/50">148 m² · 2 dormitorios + estudio · arrastra para girar</p>
            </div>
            <div className="pointer-events-auto absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-5">
              <div className="flex flex-wrap justify-center gap-2">
                {PARADAS.map((pa, i) => (
                  <button
                    key={pa.id}
                    type="button"
                    onClick={() => ir(i)}
                    className="etiqueta vidrio rounded-full px-3.5 py-2 !text-[10px] text-white/80 transition-colors hover:bg-white/15"
                  >
                    {pa.ambiente}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* recorrido: ficha de vidrio del ambiente */}
      <AnimatePresence mode="wait">
        {p && (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.55, ease: EASE }}
            className="absolute bottom-10 left-[4vw] w-[340px] max-w-[calc(100vw-32px)] rounded-[12px] border border-white/25 bg-white/55 p-6 text-noche shadow-[0_20px_60px_rgba(0,0,0,.12)] backdrop-blur-xl"
          >
            <p className="etiqueta !text-[10px] text-noche/50">
              {String(parada! + 1).padStart(2, '0')} / {String(PARADAS.length).padStart(2, '0')} · {p.ambiente}
            </p>
            <h3 className="mt-3 text-[22px] leading-tight font-light">{p.titulo}</h3>
            <p className="mt-3 text-[13px] leading-relaxed text-noche/65">{p.texto}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-noche/10 pt-4">
              {p.datos.map(([k, v]) => (
                <div key={k}>
                  <dt className="etiqueta !text-[9px] text-noche/45">{k}</dt>
                  <dd className="mt-1 text-[14px]">{v}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>

      {/* riel del recorrido: un punto por ambiente, se llena con el scroll */}
      {listo && !enPlanta && (
        <div
          ref={riel}
          className="absolute top-1/2 right-[calc(4vw+10px)] h-[min(260px,40vh)] w-px -translate-y-1/2 bg-white/25"
          style={{ ['--avance' as string]: 0 }}
        >
          <div className="absolute inset-x-0 top-0 bg-white/90" style={{ height: 'calc(var(--avance) * 100%)' }} />
          {PARADAS.map((pa, i) => (
            <button
              key={pa.id}
              type="button"
              aria-label={pa.ambiente}
              onClick={() => ir(i)}
              className="group absolute left-1/2 -translate-x-1/2 -translate-y-1/2 p-2"
              style={{ top: `${(i / (PARADAS.length - 1)) * 100}%` }}
            >
              <span
                className={`block size-[7px] rounded-full border border-white/80 transition-colors duration-300 ${parada === i ? 'bg-white' : 'bg-black/30'}`}
              />
              <span
                className={`etiqueta pointer-events-none absolute top-1/2 right-7 -translate-y-1/2 !text-[9px] whitespace-nowrap text-white/85 transition-opacity duration-300 group-hover:opacity-100 ${parada === i ? 'opacity-100' : 'opacity-0'}`}
              >
                {pa.ambiente}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* aviso: el recorrido es con scroll */}
      <AnimatePresence>
        {listo && activa && !movido && !enPlanta && parada === 0 && (
          <motion.p
            key="aviso"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.8, ease: EASE }}
            className="etiqueta vidrio pointer-events-none absolute bottom-12 left-1/2 hidden -translate-x-1/2 items-center gap-2.5 rounded-full px-4 py-2.5 !text-[10px] text-white/85 md:inline-flex"
          >
            <Mouse className="size-3.5 animate-bounce" /> Desliza para recorrer
          </motion.p>
        )}
      </AnimatePresence>

      {listo && (parada !== null || enPlanta) && !ocupado && (
        <div className="absolute right-[4vw] bottom-10 flex items-center gap-2">
          {!enPlanta && (
            <button
              type="button"
              onClick={verPlanta}
              className="etiqueta inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/45 px-4 py-3 !text-[10px] text-noche backdrop-blur-xl transition-colors hover:bg-white/70"
            >
              <LayoutGrid className="size-3.5" /> Ver planta
            </button>
          )}
          {enPlanta ? (
            <button
              type="button"
              onClick={() => ir(0)}
              className="etiqueta inline-flex items-center gap-2.5 rounded-full bg-white/90 px-5 py-3 text-noche transition-colors hover:bg-white"
            >
              Recorrer <ArrowRight className="size-3.5" />
            </button>
          ) : (
            <>
              <button
                type="button"
                aria-label="Ambiente anterior"
                disabled={parada === 0}
                onClick={() => ir((parada ?? 0) - 1)}
                className="grid size-11 place-items-center rounded-full border border-white/30 bg-white/45 text-noche backdrop-blur-xl transition-colors hover:bg-white/70 disabled:opacity-30"
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Ambiente siguiente"
                disabled={parada === PARADAS.length - 1}
                onClick={() => ir((parada ?? -1) + 1)}
                className="grid size-11 place-items-center rounded-full bg-noche text-white transition-colors hover:bg-black disabled:opacity-30"
              >
                <ArrowRight className="size-4" />
              </button>
            </>
          )}
        </div>
      )}

    </div>
    </>
  )
}
