import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PARADAS, MAQUETA, b, fovDeLente, type Parada } from './paradas'

/**
 * Departamento 18.03 en vivo con luz horneada en Cycles.
 * Cada grupo trae dos texturas sobre su UV de luz: albedo (color) e irradiancia (luz).
 * color final = albedo · luz · escala  →  AgX, igual que el render.
 *
 * Se carga mientras el usuario está en la portada y no dibuja nada hasta que se activa,
 * así el vuelo pre-renderizado nunca compite con el 3D.
 */

const BASE = '/residencia/'

const vert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vMundo;
  void main() {
    vUv = uv;
    vec4 m = modelMatrix * vec4(position, 1.0);
    vMundo = m.xyz;
    gl_Position = projectionMatrix * viewMatrix * m;
  }
`

// LUT 3D sacada del OCIO de Blender: lineal de escena -> pantalla con AgX + "Medium High Contrast".
// Entrada en log2 relativo a gris 0.18, el mismo rango que usa el AgX de Blender.
const LUT_N = 33
const EV_MIN = -12.47393
const EV_MAX = 4.026069
const EXPOSICION = Math.pow(2, 0.6) // misma exposición que en Blender
// reflejo especular promedio de muebles y piso, calibrado contra el último cuadro del vuelo
const BRILLO = 0.035

const frag = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tLuz;
  uniform sampler3D tLut;
  uniform float uEscala;
  uniform float uRepetir;   // >0: el albedo es una textura que se repite cada 1/uRepetir metros (piso)
  uniform float uBrillo;    // reflejo especular promedio (barniz, cuero) que el horneado difuso no trae
  varying vec2 vUv;
  varying vec3 vMundo;
  vec3 aPantalla(vec3 c) {
    vec3 s = clamp((log2(max(c, vec3(1e-10)) / 0.18) - (${EV_MIN})) / (${EV_MAX - EV_MIN}), 0.0, 1.0);
    return texture(tLut, s * ${(LUT_N - 1) / LUT_N} + ${0.5 / LUT_N}).rgb;
  }
  void main() {
    vec3 albedo;
    if (uRepetir > 0.0) {
      albedo = texture2D(tColor, vMundo.xz * uRepetir).rgb;
      // mismo "Aclarar" del material de Blender: menos saturación, más valor
      float g = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
      albedo = mix(vec3(g), albedo, 0.82) * 1.28;
    } else {
      albedo = texture2D(tColor, vUv).rgb;
    }
    vec3 luz = texture2D(tLuz, vUv).rgb * uEscala;
    gl_FragColor = vec4(aPantalla((albedo + uBrillo) * luz * ${EXPOSICION}), 1.0);
  }
`

/** Carga la LUT (N³ RGBA8, r rápido -> b lento) como textura 3D con interpolación lineal. */
async function cargarLut(url: string) {
  const datos = new Uint8Array(await (await fetch(url)).arrayBuffer())
  const t = new THREE.Data3DTexture(datos, LUT_N, LUT_N, LUT_N)
  t.format = THREE.RGBAFormat
  t.type = THREE.UnsignedByteType
  t.minFilter = t.magFilter = THREE.LinearFilter
  t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping
  t.unpackAlignment = 1
  t.needsUpdate = true
  return t
}

export type Residencia = {
  /** activa = se ve y se dibuja; inactiva = pausada (no gasta GPU) */
  setActiva: (v: boolean) => void
  /** el vuelo terminó en la sala: el 3D aparece en esa misma pose */
  llegar: () => Promise<void>
  /** vuelve a la vista de la sala (donde arranca el vuelo de regreso) */
  volverAlInicio: () => Promise<void>
  irA: (indice: number) => Promise<void>
  planta: () => Promise<void>
  dispose: () => void
}

type Opciones = {
  onProgreso?: (p: number) => void
  onListo?: () => void
  /** parada en la que el recorrido está quieto (null = en movimiento o en planta) */
  onParada?: (i: number | null) => void
  /** avance del recorrido de 0 (sala) a 1 (última parada), en cada cuadro */
  onAvance?: (a: number) => void
  /** el usuario siguió subiendo desde la sala: quiere volver a la torre */
  onVolver?: () => void
}

export function crearResidencia(canvas: HTMLCanvasElement, op: Opciones = {}): Residencia {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.toneMappingExposure = EXPOSICION // plantas y vidrios (lo horneado usa la LUT de Blender)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  // la cámara arranca exactamente donde termina el vuelo pre-renderizado (primera parada)
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 400)
  let lente = PARADAS[0].lente
  camera.position.copy(PARADAS[0].pos)
  camera.lookAt(PARADAS[0].mira)

  const cielo = crearCielo()
  scene.add(cielo)

  // luz solo para las plantas (lo demás trae su luz horneada)
  scene.add(new THREE.HemisphereLight('#ffe9d6', '#8a7a6a', 1.6))
  const sol = new THREE.DirectionalLight('#ffc38f', 1.4)
  sol.position.copy(b(-6, -10, 3))
  scene.add(sol)

  const grupos: Record<string, THREE.Object3D> = {}
  const texturas: THREE.Texture[] = []

  const manager = new THREE.LoadingManager()
  manager.onProgress = (_u, cargados, total) => op.onProgreso?.(cargados / total)
  const tex = new THREE.TextureLoader(manager)
  const cargarTex = (n: string) => {
    const t = tex.load(BASE + n)
    t.flipY = false
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    texturas.push(t)
    return t
  }

  const draco = new DRACOLoader(manager).setDecoderPath('/draco/')
  const gltf = new GLTFLoader(manager).setDRACOLoader(draco)

  let vivo = true
  let cargado = false
  Promise.all([fetch(BASE + 'residencia.json').then((r) => r.json()), cargarLut(BASE + 'agx_mhc.bin')])
    .then(([info, lut]: [{ escalaLuz: number; horneados: string[] }, THREE.Data3DTexture]) => {
      gltf.load(
        BASE + 'residencia.glb',
        (g) => {
          if (!vivo) return
          g.scene.traverse((o) => {
            const m = o as THREE.Mesh
            if (!m.isMesh) return
            // mallas con varios materiales vienen como hijos de un grupo con el nombre del objeto
            const nombre = (m.parent && m.parent !== g.scene ? m.parent.name : m.name).split('.')[0]
            const grupo = info.horneados.find((h) => nombre.startsWith(h)) ?? nombre
            if (info.horneados.includes(grupo)) {
              const g2 = grupo.toLowerCase()
              const esPiso = grupo === 'Piso'
              const colorT = cargarTex(esPiso ? 'roble_color.webp' : `${g2}_color.webp`)
              if (esPiso) colorT.wrapS = colorT.wrapT = THREE.RepeatWrapping
              m.material = new THREE.ShaderMaterial({
                uniforms: {
                  tColor: { value: colorT },
                  tLuz: { value: cargarTex(`${g2}_luz.webp`) },
                  uEscala: { value: info.escalaLuz },
                  uRepetir: { value: esPiso ? 1 / 1.2 : 0 },
                  tLut: { value: lut },
                  uBrillo: { value: grupo.startsWith('Muebles') || esPiso ? BRILLO : 0 },
                },
                vertexShader: vert,
                fragmentShader: frag,
                toneMapped: false,
              })
            } else if (grupo.startsWith('Vidrios')) {
              // vidrio con recubrimiento: oscurece y enfría apenas el exterior, como un muro cortina real
              m.material = new THREE.MeshBasicMaterial({ color: '#27313a', transparent: true, opacity: 0.16, depthWrite: false })
              m.renderOrder = 2
            } else if (grupo.startsWith('Montantes')) {
              m.material = new THREE.MeshBasicMaterial({ color: '#141312' })
            } else {
              // plantas: materiales originales, con recorte de hojas
              const mats = Array.isArray(m.material) ? m.material : [m.material]
              mats.forEach((mt) => {
                const s = mt as THREE.MeshStandardMaterial
                if (s.map) s.alphaTest = 0.5
                s.side = THREE.DoubleSide
              })
            }
            grupos[grupo] = grupos[grupo] ?? m
          })
          scene.add(g.scene)
          aplicarModo('recorrido')
          // todo a la GPU ahora (en la portada), no en el primer cuadro visible
          manager.onLoad = () => {
            texturas.forEach((t) => renderer.initTexture(t))
            renderer.compile(scene, camera)
            cargado = true
            op.onListo?.()
          }
        },
        undefined,
        (e) => console.error('[residencia] no se pudo cargar el modelo', e),
      )
    })
    .catch((e) => console.error('[residencia]', e))

  // ------------------------------------------------------------ controles
  const orbit = new OrbitControls(camera, canvas)
  orbit.target.copy(MAQUETA.mira)
  orbit.enableDamping = true
  orbit.enablePan = false
  orbit.minDistance = 14
  orbit.maxDistance = 40
  orbit.minPolarAngle = 0.25
  orbit.maxPolarAngle = 1.2
  orbit.rotateSpeed = 0.5
  orbit.enabled = false

  type Modo = 'recorrido' | 'planta'
  let modo: Modo = 'recorrido'
  let activa = false
  let animando = false
  /** mirar alrededor (arrastrar), relativo a la vista del recorrido */
  const mirar = { yaw: 0, pitch: 0, arrastrando: false, tactil: false, x: 0, y: 0 }
  const base = { pos: new THREE.Vector3(), mira: new THREE.Vector3() }

  // ------------------------------------------------------------ recorrido con scroll
  // Se camina por una ruta continua (pasando por las puertas) a la altura de los ojos.
  // El scroll mueve un objetivo en metros; la cámara lo sigue como una persona: arranca y frena
  // suave, mira hacia donde camina y gira la cabeza con velocidad limitada (nunca de golpe).
  // Cerca de cada ambiente gira, de a poco, hacia la vista de ese ambiente.
  const ULTIMA = PARADAS.length - 1
  const tramos = PARADAS.slice(0, -1).map(
    (p, i) => new THREE.CatmullRomCurve3([p.pos, ...p.haciaSiguiente, PARADAS[i + 1].pos], false, 'centripetal'),
  )
  const largos = tramos.map((c) => c.getLength())
  /** distancia (m) de cada parada desde la sala, por la ruta */
  const D = largos.reduce((acc, l) => [...acc, acc[acc.length - 1] + l], [0])
  const TOTAL = D[ULTIMA]
  /** vista de cada parada, fija desde su posición: horizonte casi a nivel, nunca al techo */
  const vistas = PARADAS.map((p) => {
    const v = p.mira.clone().sub(p.pos)
    return { yaw: Math.atan2(v.x, v.z), pitch: THREE.MathUtils.clamp(Math.atan2(v.y, Math.hypot(v.x, v.z)), -0.22, 0.1) }
  })
  const PASO = { vmax: 1.25, acel: 1.1 } // m/s y m/s²: paso tranquilo
  const CABEZA = { wmax: 0.95, acel: 1.6 } // rad/s y rad/s²
  const rec = {
    actual: 0, // metros recorridos desde la sala
    objetivo: 0,
    v: 0,
    vmax: PASO.vmax,
    yaw: vistas[0].yaw,
    pitch: vistas[0].pitch,
    wy: 0,
    wp: 0,
    sentido: 1,
    dir: 0,
    /** parada hacia la que se camina (null = el usuario sigue scrolleando) */
    destino: 0 as number | null,
    ultimoInput: 0,
    parada: 0 as number | null,
    alLlegar: null as (() => void) | null,
  }
  // al llegar del vuelo se ignora un instante la rueda (inercia del trackpad)
  let sinRuedaHasta = 0
  const puedeAvanzar = () => activa && cargado && modo === 'recorrido' && !animando

  function soltarEspera() {
    const f = rec.alLlegar
    rec.alLlegar = null
    f?.()
  }

  /** delta en metros (rueda, dedo) */
  function empujar(delta: number) {
    soltarEspera()
    rec.objetivo = THREE.MathUtils.clamp(rec.objetivo + delta, -0.8, TOTAL)
    rec.dir = Math.sign(delta)
    rec.ultimoInput = performance.now()
    rec.destino = null
    rec.vmax = PASO.vmax
    // seguir subiendo desde la sala = volver a la torre (vuelo de regreso)
    if (rec.objetivo <= -0.5 && rec.actual < 0.05) {
      irAParada(0)
      op.onVolver?.()
    }
  }

  /** al soltar: la parada siguiente en el sentido del scroll (basta un toque de rueda) */
  function encajar(x: number, dir: number) {
    if (dir > 0) {
      const i = D.findIndex((d) => d > x - 0.2)
      return i < 0 ? ULTIMA : i
    }
    if (dir < 0) {
      for (let i = ULTIMA; i >= 0; i--) if (D[i] < x + 0.2) return i
      return 0
    }
    let mejor = 0
    D.forEach((d, i) => {
      if (Math.abs(d - x) < Math.abs(D[mejor] - x)) mejor = i
    })
    return mejor
  }
  function irAParada(i: number, vmax = PASO.vmax) {
    rec.destino = i
    rec.objetivo = D[i]
    rec.vmax = vmax
  }

  const onWheel = (e: WheelEvent) => {
    if (!puedeAvanzar()) return
    e.preventDefault()
    if (performance.now() < sinRuedaHasta) return
    const escala = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1
    empujar(THREE.MathUtils.clamp(e.deltaY * escala, -160, 160) / 230)
  }
  const onKey = (e: KeyboardEvent) => {
    if (!puedeAvanzar()) return
    const k = e.key
    if (k === ' ' && (e.target as HTMLElement)?.closest?.('button, a, input')) return
    const sig = k === 'ArrowDown' || k === 'PageDown' || k === ' ' ? 1 : k === 'ArrowUp' || k === 'PageUp' ? -1 : 0
    if (!sig) return
    e.preventDefault()
    soltarEspera()
    rec.dir = sig
    irAParada(THREE.MathUtils.clamp((rec.destino ?? encajar(rec.objetivo, 0)) + sig, 0, ULTIMA))
  }

  const onDown = (e: PointerEvent) => {
    if (modo !== 'recorrido' || animando) return
    mirar.arrastrando = true
    mirar.tactil = e.pointerType === 'touch'
    mirar.x = e.clientX
    mirar.y = e.clientY
  }
  const onMove = (e: PointerEvent) => {
    if (!mirar.arrastrando) return
    const dx = e.clientX - mirar.x
    const dy = e.clientY - mirar.y
    mirar.x = e.clientX
    mirar.y = e.clientY
    if (mirar.tactil) {
      // dedo: deslizar hacia arriba avanza; de lado, mira alrededor
      if (puedeAvanzar() && Math.abs(dy) > Math.abs(dx) * 0.6) empujar(-dy / 140)
      else mirar.yaw += dx * 0.004
      return
    }
    mirar.yaw += dx * 0.0035
    mirar.pitch = THREE.MathUtils.clamp(mirar.pitch + dy * 0.0025, -0.5, 0.45)
  }
  const onUp = () => (mirar.arrastrando = false)
  canvas.addEventListener('pointerdown', onDown)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKey)

  // ---- movimiento de la caminata
  const _q = new THREE.Vector3()
  const envolver = (a: number) => ((((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI
  const giro = (a: number, b: number, t: number) => a + envolver(b - a) * t
  function tramoEn(s: number) {
    let i = 0
    while (i < ULTIMA - 1 && s > D[i + 1]) i++
    return i
  }
  function puntoEn(s: number, out: THREE.Vector3) {
    const c = THREE.MathUtils.clamp(s, 0, TOTAL)
    const i = tramoEn(c)
    return out.copy(tramos[i].getPointAt(largos[i] > 1e-6 ? THREE.MathUtils.clamp((c - D[i]) / largos[i], 0, 1) : 0))
  }
  /** acerca x a la meta con velocidad y aceleración limitadas: arranca y frena suave, sin pasarse */
  function seguir(x: number, meta: number, v: number, vmax: number, acel: number, dt: number): [number, number] {
    const d = meta - x
    if (Math.abs(d) < 1e-4 && Math.abs(v) < 0.02) return [meta, 0]
    const vObj = Math.sign(d) * Math.min(vmax, Math.sqrt(2 * acel * Math.abs(d)) * 0.92, Math.abs(d) * 8)
    v += THREE.MathUtils.clamp(vObj - v, -acel * dt, acel * dt)
    const nx = x + v * dt
    if ((meta - x) * (meta - nx) <= 0) return [meta, 0] // llegó (o se pasaría)
    return [nx, v]
  }
  function mirarDesde(yaw: number, pitch: number) {
    base.mira
      .set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
      .multiplyScalar(4)
      .add(base.pos)
  }

  function actualizarRecorrido(ahora: number, dt: number) {
    if (rec.destino === null && ahora - rec.ultimoInput > 160) irAParada(encajar(rec.objetivo, rec.dir), rec.vmax)
    const meta = THREE.MathUtils.clamp(rec.objetivo, 0, TOTAL)
    ;[rec.actual, rec.v] = seguir(rec.actual, meta, rec.v, rec.vmax, PASO.acel, dt)
    const s = rec.actual
    puntoEn(s, base.pos)
    const i = tramoEn(s)
    const dPrev = s - D[i]
    const dNext = D[i + 1] - s
    const frac = THREE.MathUtils.clamp(dPrev / Math.max(largos[i], 1e-6), 0, 1)
    if (Math.abs(meta - s) > 0.05) rec.sentido = Math.sign(meta - s)

    // hacia dónde camina: un punto 1,8 m más adelante por la ruta (suaviza las esquinas)
    puntoEn(s + rec.sentido * 1.8, _q).sub(base.pos)
    const yawMarcha = Math.hypot(_q.x, _q.z) > 0.1 ? Math.atan2(_q.x, _q.z) : rec.yaw
    // cerca de un ambiente, la mirada se va hacia su vista
    const mezcla = THREE.MathUtils.smoothstep(frac, 0.3, 0.7)
    const yawVista = giro(vistas[i].yaw, vistas[i + 1].yaw, mezcla)
    const pitchVista = THREE.MathUtils.lerp(vistas[i].pitch, vistas[i + 1].pitch, mezcla)
    const wVista = 1 - THREE.MathUtils.smoothstep(Math.min(dPrev, dNext), 0.2, 1.4)
    const yawMeta = giro(yawMarcha, yawVista, wVista)
    const pitchMeta = THREE.MathUtils.lerp(-0.06, pitchVista, wVista)
    // la cabeza gira con velocidad limitada
    const [paso, wy] = seguir(0, envolver(yawMeta - rec.yaw), rec.wy, CABEZA.wmax, CABEZA.acel, dt)
    rec.yaw = envolver(rec.yaw + paso)
    rec.wy = wy
    ;[rec.pitch, rec.wp] = seguir(rec.pitch, pitchMeta, rec.wp, 0.35, 0.7, dt)
    mirarDesde(rec.yaw, rec.pitch)

    if (Math.abs(rec.v) > 0.05) {
      // al caminar, la mirada libre vuelve sola al frente
      const f = Math.exp(-dt * 5)
      mirar.yaw *= f
      mirar.pitch *= f
    }
    lente = THREE.MathUtils.lerp(PARADAS[i].lente, PARADAS[i + 1].lente, frac)
    camera.position.copy(base.pos)
    const fov = fovDeLente(lente, camera.aspect)
    if (Math.abs(fov - camera.fov) > 1e-4) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    op.onAvance?.((i + frac) / ULTIMA)
    const quieto =
      rec.destino !== null &&
      s === D[rec.destino] &&
      rec.v === 0 &&
      Math.abs(envolver(yawMeta - rec.yaw)) < 0.01 &&
      Math.abs(pitchMeta - rec.pitch) < 0.01
    const parada = quieto ? rec.destino : null
    if (parada !== rec.parada) {
      rec.parada = parada
      op.onParada?.(parada)
    }
    if (quieto) soltarEspera()
  }

  /** recorrido: techo, vidrio y cielo; planta: sin techo, sobre el fondo de la página */
  function aplicarModo(m: Modo) {
    modo = m
    orbit.enabled = m === 'planta' && !animando
    if (grupos['Techo']) grupos['Techo'].visible = m === 'recorrido'
    if (grupos['Vidrios']) grupos['Vidrios'].visible = m === 'recorrido'
    cielo.visible = m === 'recorrido'
  }

  // ------------------------------------------------------------ animaciones de cámara
  const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  const salida = (t: number) => 1 - Math.pow(1 - t, 3)
  let tween: ((ahora: number) => boolean) | null = null

  function viaje(
    ruta: THREE.Vector3[],
    mira: THREE.Vector3,
    lenteFin: number,
    ms: number,
    o: { curva?: (t: number) => number; alPaso?: (k: number) => void; adelante?: boolean } = {},
  ) {
    return new Promise<void>((res) => {
      const curva = new THREE.CatmullRomCurve3([camera.position.clone(), ...ruta], false, 'centripetal')
      const mira0 = new THREE.Vector3()
      camera.getWorldDirection(mira0)
      mira0.multiplyScalar(4).add(camera.position)
      const lente0 = lente
      const largo = curva.getLength()
      const easing = o.curva ?? suave
      let t = 0
      let antes = performance.now()
      animando = true
      orbit.enabled = false
      const adelante = new THREE.Vector3()
      const m = new THREE.Vector3()
      tween = (ahora) => {
        t = Math.min(1, t + Math.min(ahora - antes, 1000 / 30) / ms) // sin saltos si hay un tirón
        antes = ahora
        const k = easing(t)
        if (largo > 1e-3) camera.position.copy(curva.getPointAt(k))
        if (o.adelante !== false && ruta.length > 1 && largo > 1e-3) {
          // durante el trayecto se mira hacia adelante; al final, hacia la vista elegida
          adelante.copy(curva.getPointAt(Math.min(1, k + 0.08)))
          adelante.y = camera.position.y - 0.05
          const a = THREE.MathUtils.smoothstep(t, 0, 0.35)
          const c = THREE.MathUtils.smoothstep(t, 0.55, 1)
          m.copy(mira0).lerp(adelante, a * (1 - c)).lerp(mira, c)
        } else m.copy(mira0).lerp(mira, k)
        camera.lookAt(m)
        lente = THREE.MathUtils.lerp(lente0, lenteFin, k)
        camera.fov = fovDeLente(lente, camera.aspect)
        camera.updateProjectionMatrix()
        o.alPaso?.(k)
        if (t >= 1) {
          animando = false
          base.pos.copy(camera.position)
          base.mira.copy(mira)
          res()
          return false
        }
        return true
      }
    })
  }

  /** fija el recorrido quieto en una parada */
  function enParada(i: number) {
    soltarEspera()
    rec.actual = rec.objetivo = D[i]
    rec.v = rec.wy = rec.wp = 0
    rec.destino = rec.parada = i
    rec.yaw = vistas[i].yaw
    rec.pitch = vistas[i].pitch
    puntoEn(D[i], base.pos)
    mirarDesde(rec.yaw, rec.pitch)
    lente = PARADAS[i].lente
    camera.position.copy(base.pos)
    camera.lookAt(base.mira)
    camera.fov = fovDeLente(lente, camera.aspect)
    camera.updateProjectionMatrix()
    op.onAvance?.(i / ULTIMA)
    op.onParada?.(i)
  }

  /** espera a que el recorrido llegue (y se quede) en la parada i */
  function recorrerHasta(i: number, vmax: number) {
    soltarEspera()
    return new Promise<void>((res) => {
      rec.dir = Math.sign(D[i] - rec.actual)
      irAParada(i, vmax)
      rec.alLlegar = res
    })
  }

  /** el vuelo terminó en la sala: el 3D aparece en esa misma pose, quieto */
  async function llegar() {
    tween = null
    animando = false
    aplicarModo('recorrido')
    mirar.yaw = mirar.pitch = 0
    enParada(0)
    sinRuedaHasta = performance.now() + 900
  }

  /** antes de volver a la torre: regresar a la vista exacta de la sala (donde empieza el vuelo de vuelta) */
  async function volverAlInicio() {
    if (modo === 'planta') await irA(0)
    else if (rec.actual !== 0 || rec.objetivo !== 0) await recorrerHasta(0, PASO.vmax * 2.5)
    if (Math.abs(mirar.yaw) > 1e-3 || Math.abs(mirar.pitch) > 1e-3) {
      // deshacer la mirada libre suavemente
      mirar.yaw = mirar.pitch = 0
      const p = PARADAS[0]
      await viaje([p.pos], p.mira, p.lente, 500, { curva: salida })
    }
    enParada(0)
  }

  async function irA(i: number) {
    const p: Parada = PARADAS[i]
    if (modo === 'planta') {
      op.onParada?.(null)
      mirar.yaw = mirar.pitch = 0
      // de la planta al ambiente: baja y se cierra el techo al entrar
      await viaje([p.pos.clone().add(new THREE.Vector3(0, 9, 6)), p.pos], p.mira, p.lente, 2600, {
        alPaso: (k) => k > 0.75 && modo === 'planta' && aplicarModo('recorrido'),
      })
      aplicarModo('recorrido')
      enParada(i)
      return
    }
    // dentro del departamento se camina por la misma ruta que el scroll
    await recorrerHasta(i, PASO.vmax * 1.2)
  }

  async function planta() {
    soltarEspera()
    rec.parada = null
    op.onParada?.(null)
    const desde = camera.position.clone()
    await viaje([desde.clone().add(new THREE.Vector3(0, 6, 4)), MAQUETA.pos], MAQUETA.mira, MAQUETA.lente, 2400, {
      alPaso: (k) => k > 0.12 && modo === 'recorrido' && aplicarModo('planta'),
    })
    aplicarModo('planta')
    orbit.target.copy(MAQUETA.mira)
    orbit.enabled = true
  }

  // ------------------------------------------------------------ bucle
  const tamaño = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    const pr = renderer.getPixelRatio()
    if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) {
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.fov = fovDeLente(lente, camera.aspect)
      camera.updateProjectionMatrix()
    }
  }
  const mirada = new THREE.Vector3()
  const arriba = new THREE.Vector3(0, 1, 0)
  let antes = 0
  renderer.setAnimationLoop((ahora) => {
    const dt = Math.min(ahora - antes, 50) / 1000
    antes = ahora
    if (!activa || !cargado) return // pausado: no compite con el vuelo
    tamaño()
    if (tween && !tween(ahora)) tween = null
    if (!animando && modo === 'planta') orbit.update()
    if (!animando && modo === 'recorrido') {
      actualizarRecorrido(ahora, dt)
      // mirar alrededor de la vista base
      const dir = base.mira.clone().sub(base.pos).normalize()
      dir.applyAxisAngle(arriba, -mirar.yaw)
      const lado = new THREE.Vector3().crossVectors(dir, arriba).normalize()
      dir.applyAxisAngle(lado, -mirar.pitch)
      mirada.copy(camera.position).add(dir)
      camera.lookAt(mirada)
    }
    cielo.position.copy(camera.position)
    renderer.render(scene, camera)
  })

  return {
    setActiva(v) {
      activa = v
    },
    llegar,
    volverAlInicio,
    irA,
    planta,
    dispose() {
      vivo = false
      renderer.setAnimationLoop(null)
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      orbit.dispose()
      renderer.dispose()
      draco.dispose()
    },
  }
}

/** Cielo para ver por las ventanas: la vista 360° desde el nivel 18 (o un degradado mientras no exista). */
function crearCielo() {
  // esfera vista desde adentro: se invierte en X para que la panorámica no salga espejada
  const geo = new THREE.SphereGeometry(150, 48, 24)
  geo.scale(-1, 1, 1)
  const mat = new THREE.ShaderMaterial({
    side: THREE.FrontSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 cenit = vec3(0.42, 0.50, 0.72);
        vec3 medio = vec3(0.86, 0.66, 0.70);
        vec3 horizonte = vec3(1.0, 0.80, 0.62);
        vec3 abajo = vec3(0.30, 0.30, 0.36);
        vec3 c = h > 0.0
          ? mix(horizonte, mix(medio, cenit, smoothstep(0.15, 0.6, h)), smoothstep(0.0, 0.18, h))
          : mix(horizonte * 0.8, abajo, smoothstep(0.0, 0.12, -h));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const m = new THREE.Mesh<THREE.SphereGeometry, THREE.Material>(geo, mat)
  m.renderOrder = -1
  new THREE.TextureLoader().load(
    // ?vista=nombre carga vista_nombre.webp (para comparar paisajes sin tocar el definitivo)
    BASE + `vista${(new URLSearchParams(location.search).get('vista') ?? '').replace(/[^a-z0-9]/gi, '').replace(/^(.+)$/, '_$1')}.webp`,
    (t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      m.material = new THREE.MeshBasicMaterial({ map: t, side: THREE.FrontSide, depthWrite: false, toneMapped: false })
      m.rotation.y = VISTA_GIRO
    },
    undefined,
    () => {},
  )
  return m
}

/**
 * Giro de la vista 360°: el centro de la imagen es +Y de Blender (= -Z en Three) y con la
 * esfera invertida el centro cae en -X, así que se gira -90°.
 */
const VISTA_GIRO = -Math.PI / 2
