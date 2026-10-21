import { Link, NavLink, Outlet } from 'react-router-dom'
import { Languages, LogOut, Settings } from 'lucide-react'
import logo from '../assets/logo.png'
import { useAuth } from '../auth/context'
import { useI18n } from '../i18n/context'

export function Layout() {
  const { t, toggleLang } = useI18n()
  const { user, logout } = useAuth()
  return (
    <div className="flex min-h-screen flex-col font-sans selection:bg-indigo-500 selection:text-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-[200] focus:rounded focus:bg-indigo-600 focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/70 backdrop-blur-md">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6" aria-label="Main">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="" className="h-10 w-10 rounded-full border-2 border-indigo-500 object-cover shadow-lg shadow-indigo-500/20" />
            <span className="text-xl font-bold tracking-tight">{t('appName')}</span>
          </Link>
          <div className="flex items-center gap-1 text-sm sm:gap-2">
            <button onClick={toggleLang} className="btn-ghost px-3! py-1.5!" aria-label="Change language / החלפת שפה">
              <Languages size={16} aria-hidden />
              {t('language')}
            </button>
            {user && (
              <>
                <NavLink to="/settings" className="btn-ghost px-3! py-1.5!" title={user.email}>
                  <Settings size={16} aria-hidden />
                  <span className="hidden sm:inline">{t('settings')}</span>
                </NavLink>
                <button onClick={() => void logout()} className="btn-ghost px-3! py-1.5!">
                  <LogOut size={16} aria-hidden />
                  <span className="hidden sm:inline">{t('logout')}</span>
                </button>
              </>
            )}
          </div>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800 px-4 py-6 text-center text-xs text-slate-500">
        <p className="mx-auto max-w-2xl">{t('disclaimer')}</p>
      </footer>
    </div>
  )
}
