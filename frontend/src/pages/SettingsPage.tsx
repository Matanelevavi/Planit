import { useState, type FormEvent } from 'react'
import axios from 'axios'
import { api, errorKey } from '../api/client'
import { useAuth } from '../auth/context'
import { Field } from '../components/Field'
import { useToast } from '../components/toast-context'
import { useI18n } from '../i18n/context'
import type { StringKey } from '../i18n/strings'
import { validateNewPassword } from '../lib/validation'

export function SettingsPage() {
  const { t } = useI18n()
  const { user, adoptToken, clearSession, logout } = useAuth()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [pwError, setPwError] = useState<StringKey | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletePw, setDeletePw] = useState('')
  const [deleteError, setDeleteError] = useState<StringKey | null>(null)

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    const weak = validateNewPassword(next)
    setPwError(weak)
    if (weak || !current) return setPwError(weak ?? 'required')
    try {
      const r = await api.post<{ access_token: string }>('/auth/change-password', { current_password: current, new_password: next })
      await adoptToken(r.data.access_token)
      setCurrent('')
      setNext('')
      toast.show(t('passwordChanged'))
    } catch (err) {
      setPwError(axios.isAxiosError(err) && err.response?.status === 400 ? 'wrongPassword' : errorKey(err))
    }
  }

  const exportData = async () => {
    try {
      const r = await api.get('/auth/export')
      const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'planit-data.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.show(t(errorKey(err)), 'error')
    }
  }

  const logoutAll = async () => {
    try {
      await api.post('/auth/logout-all')
      clearSession()
    } catch (err) {
      toast.show(t(errorKey(err)), 'error')
    }
  }

  const deleteAccount = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api.delete('/auth/me', { data: { password: deletePw } })
      clearSession()
    } catch (err) {
      setDeleteError(axios.isAxiosError(err) && err.response?.status === 400 ? 'wrongPassword' : errorKey(err))
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <h1 className="text-3xl font-extrabold">{t('settings')}</h1>
      <p className="text-slate-400" dir="ltr">{user?.email}</p>

      <form onSubmit={changePassword} noValidate className="card space-y-4" aria-labelledby="pw-h">
        <h2 id="pw-h" className="text-xl font-semibold">{t('changePassword')}</h2>
        <Field label={t('currentPassword')} type="password" autoComplete="current-password" dir="ltr" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Field label={t('newPassword')} type="password" autoComplete="new-password" dir="ltr" value={next} onChange={(e) => setNext(e.target.value)} hint={t('passwordHint')} error={pwError ?? undefined} />
        <button className="btn-primary" type="submit">{t('save')}</button>
      </form>

      <section className="card space-y-3">
        <h2 className="text-xl font-semibold">{t('exportData')}</h2>
        <p className="text-sm text-slate-400">{t('exportSub')}</p>
        <button className="btn-ghost" onClick={() => void exportData()}>{t('exportData')}</button>
      </section>

      <section className="card space-y-3">
        <button className="btn-ghost" onClick={() => void logoutAll()}>{t('logoutAll')}</button>
        <button className="btn-ghost ms-3" onClick={() => void logout()}>{t('logout')}</button>
      </section>

      <section className="card space-y-3 border-red-500/30">
        <h2 className="text-xl font-semibold text-red-300">{t('deleteAccount')}</h2>
        <p className="text-sm text-slate-400">{t('deleteAccountSub')}</p>
        {confirmDelete ? (
          <form onSubmit={deleteAccount} className="space-y-3">
            <Field label={t('password')} type="password" autoComplete="current-password" dir="ltr" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} error={deleteError ?? undefined} />
            <div className="flex gap-3">
              <button className="btn-danger" type="submit" disabled={!deletePw}>{t('deleteAccount')}</button>
              <button className="btn-ghost" type="button" onClick={() => setConfirmDelete(false)}>{t('cancel')}</button>
            </div>
          </form>
        ) : (
          <button className="btn-danger" onClick={() => setConfirmDelete(true)}>{t('deleteAccount')}</button>
        )}
      </section>
    </div>
  )
}
