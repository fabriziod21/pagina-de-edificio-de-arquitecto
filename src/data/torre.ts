// Datos de la torre Ceiba (proyecto conceptual: cifras inventadas).
// Las coordenadas de cada nivel salen de proyectar la cámara de Blender sobre
// el render de portada (1920×1080): ver blender/pisos.json.

export const RENDER = { w: 1920, h: 1080 } as const

/** Franja de fachada de cada nivel en píxeles del render. */
export const FACHADA = {
  x: 902.4,
  w: 330.2,
  /** borde superior del nivel 1 */
  y1: 885.3,
  /** alto de un nivel en el render */
  paso: 27.62,
} as const

export const TOTAL_NIVELES = 26
export const ALTURA_M = 128

export type Serie = {
  id: 'jardin' | 'horizonte' | 'cielo' | 'penthouse'
  nombre: string
  desde: number
  hasta: number
  porNivel: number
  interior: [number, number]
  dormitorios: string
  descripcion: string
  /** precio en el primer nivel de la serie (US$) y aumento por nivel */
  precioBase: number
  precioPaso: number
}

export const SERIES: Serie[] = [
  {
    id: 'jardin',
    nombre: 'Residencias Jardín',
    desde: 1,
    hasta: 10,
    porNivel: 4,
    interior: [92, 118],
    dormitorios: '2 – 3',
    descripcion: 'A la altura de las copas: el parque entra por cada ventana y la terraza mira al verde.',
    precioBase: 520_000,
    precioPaso: 14_000,
  },
  {
    id: 'horizonte',
    nombre: 'Residencias Horizonte',
    desde: 11,
    hasta: 22,
    porNivel: 3,
    interior: [112, 148],
    dormitorios: '2 – 3',
    descripcion: 'Esquinas de vidrio que enmarcan la ciudad de un lado y el parque del otro.',
    precioBase: 780_000,
    precioPaso: 22_000,
  },
  {
    id: 'cielo',
    nombre: 'Residencias Cielo',
    desde: 23,
    hasta: 25,
    porNivel: 2,
    interior: [185, 210],
    dormitorios: '3 – 4',
    descripcion: 'Dos residencias por nivel, vista de 270° y el atrio dorado como terraza privada.',
    precioBase: 1_450_000,
    precioPaso: 60_000,
  },
  {
    id: 'penthouse',
    nombre: 'Penthouse',
    desde: 26,
    hasta: 26,
    porNivel: 1,
    interior: [360, 360],
    dormitorios: '4',
    descripcion: 'Un solo hogar en la cima, bajo el sky lobby, con 360° de cielo y parque.',
    precioBase: 3_200_000,
    precioPaso: 0,
  },
]

// Residencias disponibles por nivel (suman 28 de 83).
const DISPONIBLES = [1, 2, 0, 1, 2, 1, 0, 2, 1, 1, 1, 0, 2, 1, 1, 0, 2, 1, 1, 0, 1, 2, 1, 1, 2, 1]

export type Nivel = {
  n: number
  serie: Serie
  elevacion: number
  precioDesde: number
  disponibles: number
  /** índices de las unidades disponibles dentro de la planta */
  unidadesLibres: number[]
}

function serieDe(n: number) {
  return SERIES.find((s) => n >= s.desde && n <= s.hasta)!
}

// orden fijo y "aleatorio" para repartir qué unidades quedan libres
const ORDEN = [2, 0, 3, 1]

export const NIVELES: Nivel[] = Array.from({ length: TOTAL_NIVELES }, (_, i) => {
  const n = i + 1
  const serie = serieDe(n)
  const disponibles = Math.min(DISPONIBLES[i], serie.porNivel)
  const orden = ORDEN.filter((u) => u < serie.porNivel)
  const rot = n % orden.length
  const rotado = [...orden.slice(rot), ...orden.slice(0, rot)]
  return {
    n,
    serie,
    elevacion: Math.round((10 + 4.2 * i) * 10) / 10,
    precioDesde: serie.precioBase + serie.precioPaso * (n - serie.desde),
    disponibles,
    unidadesLibres: rotado.slice(0, disponibles),
  }
})

export const TOTAL_RESIDENCIAS = SERIES.reduce((t, s) => t + s.porNivel * (s.hasta - s.desde + 1), 0)
export const TOTAL_DISPONIBLES = NIVELES.reduce((t, l) => t + l.disponibles, 0)

/** Rectángulo del nivel n en coordenadas del render. */
export function franja(n: number) {
  return {
    x: FACHADA.x,
    y: FACHADA.y1 - FACHADA.paso * (n - 1),
    w: FACHADA.w,
    h: FACHADA.paso,
  }
}

export function precio(v: number) {
  if (v >= 1_000_000) return `US$ ${(v / 1_000_000).toFixed(2).replace(/\.?0+$/, '')} M`
  return `US$ ${Math.round(v / 1000)} K`
}
