import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { GuestOnly, RequireAuth } from './components/RouteGuards'
import { useI18n } from './i18n/context'
import { AuthPage } from './pages/AuthPage'
import { Dashboard } from './pages/Dashboard'
import { SettingsPage } from './pages/SettingsPage'

// The detail page pulls in the charting library, so it is loaded on demand.
const GoalDetail = lazy(() => import('./pages/GoalDetail').then((m) => ({ default: m.GoalDetail })))

function NotFound() {
  const { t } = useI18n()
  return (
    <div className="space-y-4 text-center">
      <p>{t('notFound')}</p>
      <Link to="/" className="btn-ghost">
        {t('backToGoals')}
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/goals/:id"
            element={
              <Suspense fallback={null}>
                <GoalDetail />
              </Suspense>
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
