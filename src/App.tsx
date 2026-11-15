import { Carga } from './components/Carga'
import { Hero } from './components/Hero'
import { Nav } from './components/Nav'
import { Residencia } from './components/Residencia'

/** ?residencia: abre directo el departamento 3D (para probarlo sin pasar por el vuelo). */
const SOLO_RESIDENCIA = new URLSearchParams(location.search).has('residencia')

// Todo se monta al abrir la página y descarga debajo de la pantalla de carga (portada, cuadros
// del vuelo y departamento 3D). Las animaciones de entrada esperan a que la carga termine.
export default function App() {
  if (SOLO_RESIDENCIA)
    return (
      <main className="relative h-svh overflow-hidden">
        <Carga partes={['residencia']} />
        <Nav />
        <Residencia />
      </main>
    )
  return (
    <main className="relative">
      <Carga partes={['portada', 'vuelo', 'residencia']} />
      <Nav />
      <Hero />
    </main>
  )
}
