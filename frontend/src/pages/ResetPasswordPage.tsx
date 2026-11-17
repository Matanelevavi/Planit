import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Lock } from 'lucide-react'
import { api, errorKey } from '../api/client'
import { Field } from '../components/Field'
import { useI18n } from '../i18n/context'
import type { StringKey } from '../i18n/strings'
import { validateNewPassword } from '../lib/validation'

export function ResetPasswordPage() {
  const { t } = useI18n()
  const token = useSearchParams()[0].get('token') ?? ''
  const [password, setPassword] = useState('')
  const [error, setError] = useState<StringKey | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const weak = validateNewPassword(password)
    setError(weak)
    if (weak) return
    setBusy(true)
    try {
      await api.post('/auth/reset-password', { token, new_password: password })
      setDone(true)
    } catch (err) {
      setError(axios.isAxiosError(err) && err.response?.status === 400 ? 'resetInvalid' : errorKey(err))
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p role="alert">{t('resetInvalid')}</p>
        <Link to="/forgot-password" className="btn-ghost">
          {t('forgotPassword')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-center text-3xl font-extrabold">{t('resetPasswordTitle')}</h1>
      {done ? (
        <div className="card space-y-4 text-center">
          <p role="status" className="text-emerald-300">
            {t('resetDone')}
          </p>
          <Link to="/login" className="btn-primary">
            {t('login')}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="card space-y-4">
          <Field label={t('newPassword')} type="password" dir="ltr" autoComplete="new-password" icon={<Lock size={18} />} value={password} onChange={(e) => setPassword(e.target.value)} hint={t('passwordHint')} error={error && error !== 'resetInvalid' && error !== 'genericError' && error !== 'networkError' && error !== 'tooManyAttempts' ? error : undefined} maxLength={128} />
          {error && ['resetInvalid', 'genericError', 'networkError', 'tooManyAttempts'].includes(error) && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {t(error)}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t('loading') : t('save')}
          </button>
        </form>
      )}
    </div>
  )
}
