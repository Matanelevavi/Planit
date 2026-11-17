import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { Mail } from 'lucide-react'
import { api, errorKey } from '../api/client'
import { Field } from '../components/Field'
import { useI18n } from '../i18n/context'
import type { StringKey } from '../i18n/strings'
import { validateEmail } from '../lib/validation'

export function ForgotPasswordPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<StringKey | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validateEmail(email)) return setError('invalidEmail')
    setError(null)
    setBusy(true)
    try {
      await api.post('/auth/forgot-password', { email: email.trim() })
      setSent(true) // same message whether or not the e-mail exists
    } catch (err) {
      setError(axios.isAxiosError(err) && err.response?.status === 501 ? 'resetUnavailable' : errorKey(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-extrabold">{t('forgotPassword')}</h1>
        <p className="text-slate-400">{t('forgotPasswordSub')}</p>
      </div>
      {sent ? (
        <p role="status" className="card text-emerald-300">
          {t('resetLinkSent')}
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="card space-y-4">
          <Field label={t('email')} type="email" dir="ltr" autoComplete="email" icon={<Mail size={18} />} value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {t(error)}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t('loading') : t('sendResetLink')}
          </button>
        </form>
      )}
      <p className="text-center text-sm">
        <Link to="/login" className="font-semibold text-indigo-400 hover:underline">
          {t('backToLogin')}
        </Link>
      </p>
    </div>
  )
}
