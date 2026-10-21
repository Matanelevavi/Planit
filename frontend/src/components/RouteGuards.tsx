import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useI18n } from '../i18n/context'

function Splash() {
  const { t } = useI18n()
  return (
    <div className="grid min-h-screen place-items-center text-slate-400" role="status">
      {t('loading')}
    </div>
  )
}

export function RequireAuth() {
  const { status } = useAuth()
  if (status === 'loading') return <Splash />
  return status === 'authed' ? <Outlet /> : <Navigate to="/login" replace />
}

export function GuestOnly() {
  const { status } = useAuth()
  if (status === 'loading') return <Splash />
  return status === 'authed' ? <Navigate to="/" replace /> : <Outlet />
}
