import { useId } from 'react'
import clsx from 'clsx'

/** The RedOak mark: an oak canopy (greens) with a rising market line, on a wine-red trunk. */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  const gradient = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="RedOak Markets logo">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f8a5a" />
          <stop offset="1" stopColor="#14452d" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="#0a1f15" />
      <g fill={`url(#${gradient})`}>
        <circle cx="32" cy="23" r="13.5" />
        <circle cx="21.5" cy="31" r="9.5" />
        <circle cx="42.5" cy="31" r="9.5" />
      </g>
      <path d="M28.6 53 30.4 37h3.2l1.8 16z" fill="#a82a3b" />
      <path d="M25 53h14" stroke="#a82a3b" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M16.5 35 24.5 28.5 30 32 38 21 46.5 15.5"
        fill="none"
        stroke="#f7f5f0"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="46.5" cy="15.5" r="3" fill="#d8566a" stroke="#0a1f15" strokeWidth="1.2" />
    </svg>
  )
}

export function Logo({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={34} />
      <span className="leading-none">
        <span className={clsx('block font-display text-[1.35rem] font-semibold tracking-tight', tone === 'dark' ? 'text-white' : 'text-oak-900')}>
          RedOak
        </span>
        <span className={clsx('block pt-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.3em]', tone === 'dark' ? 'text-oak-300' : 'text-oak-600')}>
          Markets
        </span>
      </span>
    </span>
  )
}
