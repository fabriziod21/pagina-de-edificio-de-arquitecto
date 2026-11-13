import * as THREE from 'three'

/** Coordenadas de Blender del departamento (Z arriba, metros) → Three.js (Y arriba). */
export const b = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y)

const OJO = 1.55

/** Cuadros del vuelo: 1440×810 (16:9), sensor de 36 mm horizontal. */
const ASPECTO_VUELO = 16 / 9

/**
 * FOV vertical de Three.js equivalente a una lente de Blender, con el mismo recorte
 * "object-fit: cover" que usa el canvas del vuelo. Así el 3D calza con el último cuadro.
 */
export function fovDeLente(lente: number, aspectoPantalla: number) {
  const tanH = 18 / lente // tan(hfov/2)
  const tanV = aspectoPantalla >= ASPECTO_VUELO ? tanH / aspectoPantalla : tanH / ASPECTO_VUELO
  return THREE.MathUtils.radToDeg(2 * Math.atan(tanV))
}

export type Parada = {
  id: string
  ambiente: string
  titulo: string
  texto: string
  datos: [string, string][]
  pos: THREE.Vector3
  mira: THREE.Vector3
  /** lente en mm (como en Blender) */
  lente: number
  /** puntos de paso hacia la parada siguiente (puertas) */
  haciaSiguiente: THREE.Vector3[]
}

/** Vista en planta (sin techo), sobre el fondo oscuro de la página. */
export const MAQUETA = {
  pos: b(-0.83, -17.2, 21.03),
  mira: b(8.2, 4.6, 1.6),
  lente: 60,
}

// Las rutas (haciaSiguiente) pasan por las puertas y nunca por encima de un mueble: es una caminata.
export const PARADAS: Parada[] = [
  {
    // = último cuadro del vuelo (CamVuelo, cuadro 98, lente 20 mm): el 3D toma la posta sin que se note
    id: 'sala',
    ambiente: 'Sala',
    titulo: 'Nogal, bouclé y un golpe de naranja',
    texto: 'Muro de listones de nogal, sofá de bouclé con cojines de terciopelo, mesa de piedra y un trío de globos opalinos sobre las copas del parque.',
    datos: [['Superficie', '34 m²'], ['Altura libre', '3,4 m']],
    pos: b(5.3, 1.9, OJO),
    mira: b(1.6, 5.2, 1.2),
    lente: 20,
    haciaSiguiente: [b(5.47, 4.55, OJO), b(5.47, 6.0, OJO)],
  },
  {
    id: 'estudio',
    ambiente: 'Estudio',
    titulo: 'Una biblioteca de muro a muro',
    texto: 'Escritorio de nogal con la biblioteca a la espalda, sillón de lectura y una luz rasante que baña los libros.',
    datos: [['Superficie', '18 m²'], ['Biblioteca', '4,1 m']],
    pos: b(5.2, 6.65, OJO),
    mira: b(1.5, 7.6, 1.1),
    lente: 18,
    haciaSiguiente: [b(5.47, 6.0, OJO), b(5.6, 4.6, OJO), b(7.0, 4.45, OJO)],
  },
  {
    id: 'comedor',
    ambiente: 'Comedor',
    titulo: 'Una mesa para ocho junto al vidrio',
    texto: 'Mesa de nogal macizo, sillas tapizadas en cuero y un lienzo de tierras. La puesta de sol entra de frente a la hora de la cena.',
    datos: [['Superficie', '14 m²'], ['Vista', 'Parque central']],
    pos: b(9.0, 3.9, OJO),
    mira: b(7.2, 0.8, 1.0),
    lente: 19,
    haciaSiguiente: [b(8.6, 4.55, OJO)],
  },
  {
    id: 'cocina',
    ambiente: 'Cocina',
    titulo: 'Laca arena, nogal y Calacatta',
    texto: 'Isla de Calacatta con encimera integrada, columnas en laca arena y un nicho de nogal con luz rasante sobre el lavaplatos.',
    datos: [['Isla', '2,6 m'], ['Mármol', 'Calacatta']],
    pos: b(7.75, 4.5, OJO),
    mira: b(7.75, 9.0, 1.15),
    lente: 19,
    haciaSiguiente: [b(9.1, 4.95, OJO)],
  },
  {
    id: 'recibidor',
    ambiente: 'Recibidor',
    titulo: 'La llegada',
    texto: 'Puerta de nogal desde el hall de ascensores, repisa flotante con espejo de latón y, a la derecha, el pasillo a los dormitorios.',
    datos: [['Puerta', 'Nogal, 2,45 m'], ['Baño de visitas', 'Junto al acceso']],
    pos: b(10.15, 4.85, OJO),
    mira: b(10.16, 9.0, 1.3),
    lente: 18,
    haciaSiguiente: [b(11.0, 4.9, OJO), b(11.85, 4.6, OJO)],
  },
  {
    id: 'visitas',
    ambiente: 'Dormitorio de visitas',
    titulo: 'Un cuarto de huéspedes con ventanal propio',
    texto: 'Cama tapizada contra un muro de tela, el ventanal a un costado y lámparas de lectura en cada mesa de noche.',
    datos: [['Superficie', '13 m²'], ['Ventanal', '3 m']],
    pos: b(11.95, 3.45, OJO),
    mira: b(9.8, 1.4, 0.9),
    lente: 17,
    haciaSiguiente: [b(11.85, 4.6, OJO), b(12.3, 4.95, OJO), b(13.35, 4.7, OJO)],
  },
  {
    id: 'principal',
    ambiente: 'Dormitorio principal',
    titulo: 'Despertar sobre los árboles',
    texto: 'Muro de nogal de piso a cielo, cama tapizada con colgantes opalinos, banca a los pies y un rincón de lectura en la esquina de vidrio.',
    datos: [['Superficie', '21 m²'], ['Vista', 'Doble esquina']],
    pos: b(15.6, 4.4, OJO),
    mira: b(13.4, 2.0, 0.9),
    lente: 17,
    haciaSiguiente: [b(13.45, 4.75, OJO), b(13.45, 5.9, OJO)],
  },
  {
    id: 'bano',
    ambiente: 'Baño principal',
    titulo: 'Travertino, luz y agua',
    texto: 'Tina exenta junto al vidrio bajo un globo opalino, doble vanitorio de nogal con espejos retroiluminados y muros de piedra.',
    datos: [['Superficie', '12 m²'], ['Tina', 'Exenta']],
    pos: b(13.45, 6.15, OJO),
    mira: b(15.6, 7.6, 0.9),
    lente: 17,
    haciaSiguiente: [],
  },
]
