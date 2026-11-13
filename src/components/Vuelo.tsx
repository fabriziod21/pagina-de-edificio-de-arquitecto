import { useEffect, useRef, useState } from 'react'
import { torre, useTorre } from '@/lib/estado'

// Vuelo de cámara pre-renderizado en Cycles (Blender): 98 cuadros 1440×810.
// El cuadro 1 es exactamente el encuadre de la portada y el 98 es la sala del depto 18.03,
// en la misma pose donde arranca el 3D en vivo: ninguno de los dos pasos se nota.
const CUADROS = 98
const DURACION = 4900 // ms
/** al volver, se espera a que el 3D se desvanezca sobre el último cuadro */
const ESPERA_VUELTA = 650
/** si el navegador se traba, la animación no avanza más que esto por cuadro (nunca "salta") */
const PASO_MAX = 1000 / 30
const ruta = (i: number) => `/vuelo/f_${String(i + 1).padStart(4, '0')}.webp`

// Los cuadros ya traen la aceleración de las curvas de Blender (arranque y frenado suaves):
// se reproducen a ritmo casi constante. Una curva extra encima hacía que la mitad del
// vuelo pasara en medio segundo (se sentía como un salto).
const suave = (t: number) => t - 0.04 * Math.sin(2 * Math.PI * t)

/**
 * Precarga y decodifica todos los cuadros en segundo plano (decodificar antes evita
 * que drawImage lo haga en pleno vuelo). Los que fallan se reintentan.
 */
function usarCuadros() {
  const imgs = useRef<(HTMLImageElement | undefined)[]>([])
  const [listos, setListos] = useState(0)
  useEffect(() => {
    let vivo = true
    const ok = new Array<boolean>(CUADROS).fill(false)
    const cargar = (i: number, intento: number) => {
      const im = new Image()
      im.decoding = 'async'
      im.src = intento ? `${ruta(i)}?r=${intento}` : ruta(i)
      im.decode()
        .then(() => {
          if (!vivo) return
          imgs.current[i] = im
          ok[i] = true
          setListos(ok.filter(Boolean).length)
        })
        .catch(() => {
          if (vivo) window.setTimeout(() => cargar(i, intento + 1), 4000)
        })
    }
    const t = window.setTimeout(() => {
      for (let i = 0; i < CUADROS; i++) cargar(i, 0)
    }, 1200)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [])
  return { imgs, listos }
}

export function Vuelo() {
  const { modo, residenciaLista } = useTorre()
  const canvas = useRef<HTMLCanvasElement>(null)
  const { imgs, listos } = usarCuadros()
  const progreso = useRef(modo === 'nivel' ? 1 : 0) // 0 = portada, 1 = nivel 18
  const completo = listos >= CUADROS

  // dibuja el cuadro correspondiente a "progreso" (con fundido entre cuadros vecinos)
  const dibujar = () => {
    const cv = canvas.current
    if (!cv) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const w = Math.round(cv.clientWidth * dpr)
    const h = Math.round(cv.clientHeight * dpr)
    if (cv.width !== w || cv.height !== h) {
      cv.width = w
      cv.height = h
    }
    const ctx = cv.getContext('2d', { alpha: false })!
    const f = progreso.current * (CUADROS - 1)
    const a = Math.floor(f)
    const b = Math.min(CUADROS - 1, a + 1)
    const pintar = (im: HTMLImageElement | undefined, alfa: number) => {
      // cuadro faltante: se usa el vecino más cercano que sí cargó
      if (!im) {
        const i0 = Math.round(f)
        for (let d = 1; d < CUADROS && !im; d++) im = imgs.current[i0 - d] ?? imgs.current[i0 + d]
      }
      if (!im || !im.naturalWidth) return
      const s = Math.max(w / im.naturalWidth, h / im.naturalHeight) // como object-fit: cover
      const dw = im.naturalWidth * s
      const dh = im.naturalHeight * s
      ctx.globalAlpha = alfa
      ctx.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh)
    }
    pintar(imgs.current[a], 1)
    if (b !== a) pintar(imgs.current[b], f - a)
    ctx.globalAlpha = 1
    cv.dataset.cuadro = `${a + 1}${imgs.current[a] ? '' : '?'} ${w}x${h}`
  }

  // reproduce ida o vuelta cuando cambia el modo
  useEffect(() => {
    if (modo !== 'ida' && modo !== 'vuelta') {
      if (modo === 'nivel' && completo) {
        progreso.current = 1
        dibujar()
      }
      return
    }
    if (!completo) return // se reintenta cuando terminen de cargar
    const desde = progreso.current
    const hasta = modo === 'ida' ? 1 : 0
    let t = 0
    let antes = performance.now() + (modo === 'vuelta' ? ESPERA_VUELTA : 0)
    let raf = 0
    const paso = (ahora: number) => {
      // tiempo acumulado con tope por cuadro: si hay un tirón, el vuelo se frena, no se salta
      t = Math.min(1, t + Math.max(0, Math.min(ahora - antes, PASO_MAX)) / DURACION)
      antes = Math.max(antes, ahora)
      progreso.current = desde + (hasta - desde) * suave(t)
      dibujar()
      if (t < 1) raf = requestAnimationFrame(paso)
      else torre.setModo(modo === 'ida' ? 'nivel' : 'torre')
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [modo, completo])

  useEffect(() => {
    const onResize = () => dibujar()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // en 'nivel' el último cuadro queda debajo: el 3D aparece encima en la misma pose
  const activo = modo === 'ida' || modo === 'vuelta' || modo === 'nivel'
  const esperando = (modo === 'ida' || modo === 'vuelta') && !completo
  return (
    <>
      <canvas
        ref={canvas}
        className="pointer-events-none absolute inset-0 z-[5] size-full transition-opacity duration-300"
        style={{ opacity: activo && completo ? 1 : 0 }}
        data-listos={listos}
        data-modo={modo}
        data-residencia={residenciaLista ? 'lista' : 'cargando'}
        aria-hidden
      />
      {esperando && (
        <div className="absolute inset-0 z-40 grid place-items-center">
          <div className="vidrio flex items-center gap-4 rounded-full py-2 pr-2 pl-5 text-[11px] tracking-[0.2em] text-white/80 uppercase">
            Preparando vuelo · {listos}/{CUADROS}
            <button
              type="button"
              onClick={() => torre.setModo('torre')}
              className="rounded-full border border-white/25 px-3 py-1.5 tracking-[0.2em] text-white/80 transition-colors hover:bg-white/10"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
