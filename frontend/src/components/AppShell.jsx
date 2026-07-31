import { useState } from 'react'
import { NavLink, Link, Outlet } from 'react-router-dom'
import { Dumbbell, LogOut, Menu, X } from 'lucide-react'
import { getUser, logout, homePath } from '../api/client'
import { useLanguage } from '../i18n/LanguageContext'
import NotificationBell from './NotificationBell'
import LanguageToggle from './LanguageToggle'

const navClass = ({ isActive }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'bg-blood-700 text-white' : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
  }`

const mobileNavClass = ({ isActive }) =>
  `block px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'bg-blood-700 text-white' : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
  }`

export default function AppShell({ links, showLanguageToggle = true, showNotifications = true }) {
  const user = getUser()
  const [open, setOpen] = useState(false)
  const { t } = useLanguage()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-950/95 sticky top-0 z-10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to={homePath()} className="flex items-center gap-2 font-display text-lg tracking-widest shrink-0">
            <Dumbbell className="text-blood-600" size={22} />
            BLOOD<span className="text-blood-600">&amp;</span>GUTS
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navClass}>
                {t(l.label, l.labelEn)}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3 text-sm text-neutral-400 shrink-0">
            {showLanguageToggle && <LanguageToggle />}
            {showNotifications && <NotificationBell />}
            <span className="truncate max-w-[10rem]">{user?.display_name}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-neutral-800 hover:text-white"
              title={t('Odhlásit', 'Log out')}
            >
              <LogOut size={16} />
            </button>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            {showLanguageToggle && <LanguageToggle className="p-1.5" />}
            {showNotifications && <NotificationBell />}
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-neutral-300 hover:text-white p-1.5"
              aria-label="Menu"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden border-t border-neutral-800 px-4 py-3 space-y-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={mobileNavClass} onClick={() => setOpen(false)}>
                {t(l.label, l.labelEn)}
              </NavLink>
            ))}
            <div className="flex items-center justify-between px-3 py-2.5 mt-1 border-t border-neutral-800 pt-3">
              <span className="text-sm text-neutral-400">{user?.display_name}</span>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 text-sm text-neutral-300 hover:text-white px-2 py-1 rounded-md hover:bg-neutral-800"
              >
                <LogOut size={16} /> {t('Odhlásit', 'Log out')}
              </button>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
