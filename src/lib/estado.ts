import { useSyncExternalStore } from 'react'
import { TOTAL_NIVELES } from '@/data/torre'

/** ?shot: sin animaciones de entrada (capturas con Chrome headless). */
export const SHOT = typeof location !== 'undefined' && new URLSearchParams(location.search).has('shot')

/** torre: portada · ida/vuelta: reproduciendo el vuelo · nivel: llegamos a la residencia de muestra */
export type Modo = 'torre' | 'ida' | 'nivel' | 'vuelta'

type Estado = {
  activo: number
  direccion: 1 | -1
  visible: boolean
  /** el usuario ya interactuó: se corta el barrido automático */
  tocado: boolean
  modo: Modo
  /** el departamento 3D terminó de cargar (se precarga en la portada) */
  residenciaLista: boolean
  /** la pantalla de carga terminó: la portada hace su entrada */
  entrada: boolean
  /** avance real de la descarga (0..1) de los cuadros del vuelo y del departamento 3D */
  cargaVuelo: number
  cargaResidencia: number
}

const MODO_INICIAL: Modo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nivel') ? 'nivel' : 'torre'
let estado: Estado = { activo: SHOT ? 18 : 1, direccion: 1, visible: SHOT, tocado: SHOT, modo: MODO_INICIAL, residenciaLista: false, entrada: SHOT, cargaVuelo: 0, cargaResidencia: 0 }
let reveladoEn = 0
const subs = new Set<() => void>()

function set(p: Partial<Estado>) {
  estado = { ...estado, ...p }
  subs.forEach((f) => f())
}

export const torre = {
  get: () => estado,
  subscribe(f: () => void) {
    subs.add(f)
    return () => subs.delete(f)
  },
  ir(n: number, manual = true) {
    const v = Math.max(1, Math.min(TOTAL_NIVELES, n))
    if (manual) estado.tocado = true
    if (v === estado.activo && estado.visible) return
    set({ activo: v, direccion: v >= estado.activo ? 1 : -1, visible: true })
  },
  mostrar() {
    set({ visible: true })
  },
  /** vuela a la residencia de muestra (nivel 18) */
  entrar() {
    if (estado.modo !== 'torre') return
    // con la pantalla de carga encima (y un margen por la inercia del scroll) no se inicia el vuelo
    if (!estado.entrada || performance.now() - reveladoEn < 900) return
    set({ modo: 'ida', tocado: true })
  },
  salir() {
    if (estado.modo !== 'nivel') return
    set({ modo: 'vuelta' })
  },
  setModo(modo: Modo) {
    set({ modo })
  },
  /** fin de la pantalla de carga */
  revelar() {
    if (estado.entrada) return
    reveladoEn = performance.now()
    set({ entrada: true })
  },
  setCarga(que: 'cargaVuelo' | 'cargaResidencia', v: number) {
    if (Math.abs(estado[que] - v) > 0.004 || v === 1) set({ [que]: v })
  },
  setResidenciaLista(v: boolean) {
    if (estado.residenciaLista !== v) set({ residenciaLista: v })
  },
}

/** Residencia de muestra a la que llega el vuelo pre-renderizado. */
export const NIVEL_MUESTRA = 18

export function useTorre() {
  return useSyncExternalStore(torre.subscribe, torre.get)
}

/**
 * Extremo derecho de la franja del nivel, en px relativos al hero.
 * La capa de la torre lo escribe en cada cuadro; la línea hacia la ficha lo lee sin re-render.
 */
export const anclas = {
  banda: { x: 0, y: 0, ok: false },
}
