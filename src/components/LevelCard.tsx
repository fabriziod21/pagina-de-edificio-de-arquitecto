import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { forwardRef } from 'react'
import { NIVELES, TOTAL_NIVELES, precio } from '@/data/torre'
import { torre } from '@/lib/estado'
import { cn } from '@/lib/utils'
import { MiniPlan } from './MiniPlan'

type Props = {
  activo: number
  direccion: 1 | -1
  onCambiar: (n: number) => void
  className?: string
}

const EASE = [0.22, 0.7, 0.18, 1] as const
const dos = (n: number) => String(n).padStart(2, '0')

/** Ficha del nivel: panel oscuro y opaco como en la referencia. */
export const LevelCard = forwardRef<HTMLDivElement, Props>(function LevelCard({ activo, direccion, onCambiar, className }, ref) {
  const nv = NIVELES[activo - 1]
  const s = nv.serie
  const filas: [string, string][] = [
    ['Elevación', `+${nv.elevacion.toFixed(1)} m`],
    ['Residencias', `${s.porNivel} por nivel`],
    ['Interior', s.interior[0] === s.interior[1] ? `${s.interior[0]} m²` : `${s.interior[0]} – ${s.interior[1]} m²`],
    ['Dormitorios', s.dormitorios],
    ['Precio desde', precio(nv.precioDesde)],
  ]
  return (
    <div
      ref={ref}
      className={cn(
        'w-[312px] rounded-[10px] border border-white/10 bg-[rgba(9,11,15,.8)] p-5 text-ink shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)] backdrop-blur-md',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="etiqueta !text-[8.5px] text-white/50">Nivel residencial</span>
        <div className="flex gap-1.5">
          <BotonRedondo label="Nivel superior" disabled={activo >= TOTAL_NIVELES} onClick={() => onCambiar(activo + 1)}>
            <ChevronUp className="size-3" />
          </BotonRedondo>
          <BotonRedondo label="Nivel inferior" disabled={activo <= 1} onClick={() => onCambiar(activo - 1)}>
            <ChevronDown className="size-3" />
          </BotonRedondo>
        </div>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="relative h-[78px] w-[132px] overflow-hidden">
          <AnimatePresence initial={false} custom={direccion}>
            <motion.div
              key={activo}
              initial={{ y: direccion * 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: direccion * -60, opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="absolute inset-0 flex items-start"
            >
              <span className="font-ancha text-[72px] leading-[1.02] font-extralight tracking-[-0.02em]">{dos(activo)}</span>
              <span className="font-ancha mt-2 ml-1 text-[10px] font-medium tracking-[0.1em] text-white/70">º</span>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mb-1 shrink-0">
          <MiniPlan porNivel={s.porNivel} libres={nv.unidadesLibres} className="w-[104px]" />
          <div className="etiqueta mt-1.5 flex justify-end gap-2.5 !text-[7px] !tracking-[0.18em] text-white/45">
            <span className="inline-flex items-center gap-1">
              <i className="size-[5px] bg-[rgba(214,214,198,.85)]" /> Disponible
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="size-[5px] border border-white/40" /> Vendida
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={s.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <h3 className="text-[14.5px] font-semibold tracking-tight">{s.nombre}</h3>
            <span className="etiqueta !text-[8px] text-white/45">
              N{dos(s.desde)}
              {s.hasta !== s.desde && ` – ${dos(s.hasta)}`}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/55">{s.descripcion}</p>
        </motion.div>
      </AnimatePresence>

      <dl className="mt-3.5">
        {filas.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between border-t border-white/[0.08] py-[7px] text-[11.5px]">
            <dt className="text-white/50">{k}</dt>
            <dd className="font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-2 flex items-center justify-between border-t border-white/[0.08] pt-4">
        <span className="etiqueta inline-flex items-center gap-2 !text-[7.5px] !tracking-[0.18em] whitespace-nowrap text-white/60">
          <span className={cn('size-1.5 rounded-full', nv.disponibles > 0 ? 'bg-white/85' : 'bg-white/25')} />
          {nv.disponibles > 0 ? `${nv.disponibles} de ${s.porNivel} disponibles` : 'Nivel vendido'}
        </span>
        <a
          href="#residencias"
          onClick={(e) => {
            e.preventDefault()
            torre.entrar()
          }}
          className="etiqueta group inline-flex items-center gap-2 rounded-full border border-white/35 px-3.5 py-2 !text-[8px] !tracking-[0.18em] whitespace-nowrap text-ink transition-colors hover:border-white/70 hover:bg-white/10"
        >
          Ver plantas
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>
    </div>
  )
})

function BotonRedondo({ children, label, disabled, onClick }: { children: React.ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-6 place-items-center rounded-full border border-white/25 text-white/75 transition-colors hover:border-white/60 hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  )
}
