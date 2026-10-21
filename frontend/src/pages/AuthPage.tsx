import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { Lock, Mail } from 'lucide-react'
import { errorKey } from '../api/client'
import { useAuth } from '../auth/context'
import { Field } from '../components/Field'
import { useI18n } from '../i18n/context'
import type { StringKey } from '../i18n/strings'
import { validateEmail, validateNewPassword } from '../lib/validation'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useI18n()
  const { login, register } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: StringKey; password?: StringKey }>({})
  const [formError, setFormError] = useState<StringKey | null>(null)
  const [busy, setBusy] = useState(false)
  const isLogin = mode === 'login'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const found: typeof errors = {}
    if (!validateEmail(email)) found.email = 'invalidEmail'
    if (isLogin ? !password : validateNewPassword(password)) {
      found.password = isLogin ? 'required' : (validateNewPassword(password) ?? 'required')
    }
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      await (isLogin ? login : register)(email.trim(), password)
    } catch (err) {
      setFormError(!isLogin && axios.isAxiosError(err) && err.response?.status === 409 ? 'emailTaken' : errorKey(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-extrabold">{isLogin ? t('login') : t('register')}</h1>
        <p className="text-slate-400">{t('tagline')}</p>
      </div>
      <form onSubmit={submit} noValidate className="card space-y-4">
        <Field label={t('email')} type="email" autoComplete="email" dir="ltr" icon={<Mail size={18} />} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Field
          label={t('password')}
          type="password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          dir="ltr"
          icon={<Lock size={18} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={isLogin ? undefined : t('passwordHint')}
          maxLength={128}
        />
        {formError && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {t(formError)}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? t('loading') : isLogin ? t('login') : t('register')}
        </button>
      </form>
      <p className="text-center text-sm text-slate-400">
        {isLogin ? t('noAccount') : t('haveAccount')}{' '}
        <Link to={isLogin ? '/register' : '/login'} className="font-semibold text-indigo-400 hover:underline">
          {isLogin ? t('register') : t('login')}
        </Link>
      </p>
    </div>
  )
}
