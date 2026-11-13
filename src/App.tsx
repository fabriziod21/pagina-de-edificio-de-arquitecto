import { Hero } from './components/Hero'
import { Nav } from './components/Nav'
import { Residencia } from './components/Residencia'

/** ?residencia: abre directo el departamento 3D (para probarlo sin pasar por el vuelo). */
const SOLO_RESIDENCIA = new URLSearchParams(location.search).has('residencia')

export default function App() {
  if (SOLO_RESIDENCIA)
    return (
      <main className="relative h-svh overflow-hidden">
        <Nav />
        <Residencia />
      </main>
    )
  return (
    <main className="relative">
      <Nav />
      <Hero />
    </main>
  )
}
