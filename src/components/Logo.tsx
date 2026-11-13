import { cn } from '@/lib/utils'

/** Marca: la torre vista de frente (dos alas y el atrio). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <svg viewBox="0 0 18 22" className="h-[18px] w-[15px]" aria-hidden>
        <g fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="1" y="1" width="16" height="20" rx="0.8" />
          <path d="M7 1v20M11 1v20" />
        </g>
      </svg>
      <span className="font-ancha text-[13px] font-medium tracking-[0.42em]">CEIBA</span>
    </span>
  )
}
