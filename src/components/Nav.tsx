import { ArrowUpRight, Menu } from 'lucide-react'
import { motion } from 'motion/react'
import { useTorre } from '@/lib/estado'
import { Logo } from './Logo'

const LINKS = ['Residencias', 'Amenidades', 'Ubicación', 'Contacto']

export function Nav() {
  const { entrada } = useTorre()
  return (
    <motion.header
      initial={new URLSearchParams(location.search).has('shot') ? false : { opacity: 0, y: -12 }}
      animate={entrada ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
      transition={{ duration: 1, delay: 0.3, ease: [0.22, 0.7, 0.18, 1] }}
      className="absolute inset-x-0 top-0 z-30 px-[4vw] pt-6"
    >
      <div className="flex items-center justify-between">
        <a href="#" aria-label="Ceiba, inicio" className="text-ink">
          <Logo />
        </a>

        <nav className="hidden items-center gap-9 md:flex" aria-label="Principal">
          {LINKS.map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase()}`}
              className="etiqueta text-ink/75 transition-colors duration-300 hover:text-ink"
            >
              {l}
            </a>
          ))}
          <a
            href="#contacto"
            className="etiqueta group inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2.5 text-ink transition-colors duration-300 hover:border-white/60 hover:bg-white/10"
          >
            Consultar
            <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </nav>

        <button
          type="button"
          aria-label="Abrir menú"
          className="grid size-10 place-items-center rounded-full border border-white/25 text-ink md:hidden"
        >
          <Menu className="size-4" />
        </button>
      </div>

      {/* filetes decorativos como en una lámina de arquitectura */}
      <div aria-hidden className="pointer-events-none mt-5 hidden items-center md:flex">
        <span className="relative h-px w-[26vw] bg-white/25">
          <span className="absolute -left-px -top-[3px] h-[7px] w-[7px] rotate-45 border-b border-l border-white/50" />
        </span>
        <span className="flex-1" />
        <span className="relative h-px w-[36vw] bg-white/25">
          <span className="absolute -right-1 -top-[3px] size-[7px] rounded-full border border-white/50" />
        </span>
      </div>
    </motion.header>
  )
}
