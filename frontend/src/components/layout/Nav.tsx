import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Logo } from '../brand/Logo'
import { StockSearch } from '../market/StockSearch'
import { GithubIcon, Icon } from '../ui/Icon'

export const GITHUB_URL =
  (import.meta.env.VITE_GITHUB_URL as string | undefined) ?? 'https://github.com/Divyanshi12coder/red-oak-markets'

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/markets', label: 'Markets' },
  { to: '/analyze', label: 'Analyzer' },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/compare', label: 'Compare' },
  { to: '/about', label: 'About' },
]

function NavItem({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  return (
    <NavLink to={to} onClick={onClick} className="relative rounded-lg px-3 py-2 text-sm font-medium outline-offset-0">
      {({ isActive }) => (
        <>
          <span className={clsx('relative z-10 transition-colors', isActive ? 'text-white' : 'text-oak-200 hover:text-white')}>
            {label}
          </span>
          {isActive && (
            <motion.span
              layoutId="nav-active"
              className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-oak-300"
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )}
        </>
      )}
    </NavLink>
  )
}

function ProfileMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!user) return <span className="skeleton h-10 w-10 !rounded-full !bg-white/10" aria-hidden="true" />

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-full bg-white/10 pl-1 pr-3 text-sm text-white transition hover:bg-white/20"
      >
        <span className="grid size-8 place-items-center rounded-full bg-wine-700 text-sm font-semibold">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-24 truncate xl:block">{user.name}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-stone bg-white text-ink shadow-lift"
          >
            <div className="border-b border-stone px-4 py-3">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <Link role="menuitem" to="/dashboard" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-oak-50">
              Dashboard
            </Link>
            <Link role="menuitem" to="/watchlist" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-oak-50">
              My watchlist
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false)
                logout()
                navigate('/')
              }}
              className="flex w-full items-center gap-2 border-t border-stone px-4 py-2.5 text-left text-sm text-wine-700 hover:bg-wine-50"
            >
              <Icon name="logout" size={16} /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Nav() {
  const { isAuthenticated } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const reduce = useReducedMotion()
  const { pathname } = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen])

  return (
    <header
      className={clsx(
        'on-dark sticky top-0 z-40 border-b transition-all duration-300',
        scrolled ? 'border-white/10 bg-oak-950/95 shadow-lift backdrop-blur-md' : 'border-transparent bg-oak-950',
      )}
    >
      <nav aria-label="Primary" className={clsx('container-page flex items-center justify-between gap-4 transition-all duration-300', scrolled ? 'h-14' : 'h-16')}>
        <Link to="/" aria-label="RedOak Markets home" className="shrink-0 rounded-lg">
          <Logo />
        </Link>

        <div className="hidden items-center gap-0.5 lg:flex">
          {LINKS.map((l) => (
            <NavItem key={l.to} {...l} />
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <StockSearch variant="nav" className="w-56 xl:w-64" />
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-on-dark btn-sm !min-h-10"
            aria-label="View source on GitHub (opens in a new tab)"
          >
            <GithubIcon size={16} /> <span className="hidden xl:inline">GitHub</span>
          </a>
          {isAuthenticated ? (
            <ProfileMenu />
          ) : (
            <>
              <Link to="/login" className="px-2 text-sm font-medium text-oak-100 hover:text-white">
                Log in
              </Link>
              <Link to="/signup" className="btn btn-crimson btn-sm !min-h-10">
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10 lg:hidden"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          onClick={() => setMobileOpen((o) => !o)}
        >
          <Icon name={mobileOpen ? 'close' : 'menu'} size={24} />
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/10 bg-oak-950 lg:hidden"
          >
            <div className="container-page space-y-4 py-4">
              <StockSearch variant="nav" onNavigate={() => setMobileOpen(false)} />
              <ul className="grid gap-1">
                {LINKS.map((l, i) => (
                  <motion.li
                    key={l.to}
                    initial={reduce ? false : { opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * i }}
                  >
                    <NavLink
                      to={l.to}
                      className={({ isActive }) =>
                        clsx(
                          'flex min-h-11 items-center rounded-lg px-3 text-base font-medium',
                          isActive ? 'bg-white/10 text-white' : 'text-oak-100 hover:bg-white/5',
                        )
                      }
                    >
                      {l.label}
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="btn btn-on-dark">
                  <GithubIcon size={16} /> GitHub
                </a>
                {isAuthenticated ? <ProfileMenu /> : (
                  <>
                    <Link to="/login" className="btn btn-on-dark">Log in</Link>
                    <Link to="/signup" className="btn btn-crimson">Sign up</Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
