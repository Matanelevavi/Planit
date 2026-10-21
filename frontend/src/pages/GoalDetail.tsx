import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowLeft, ArrowRight, Pencil, Trash2 } from 'lucide-react'
import { errorKey } from '../api/client'
import {
  fetchWhatIf,
  useAddContribution,
  useContributions,
  useDeleteContribution,
  useDeleteGoal,
  useGoal,
  useProjection,
  useUpdateGoal,
} from '../api/hooks'
import { Field } from '../components/Field'
import { GoalForm } from '../components/GoalForm'
import { ProgressBar } from '../components/ProgressBar'
import { ProjectionChart } from '../components/ProjectionChart'
import { StatusBadge } from '../components/StatusBadge'
import { useToast } from '../components/toast-context'
import { useI18n } from '../i18n/context'
import { formatDate, formatMoney, todayISO } from '../lib/format'
import { validateContribution, type ContributionField, type Errors } from '../lib/validation'

function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

export function GoalDetail() {
  const id = Number(useParams().id)
  const valid = Number.isInteger(id) && id > 0
  const { t, lang, dir } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const goal = useGoal(valid ? id : 0)
  const entries = useContributions(valid ? id : 0)
  const projection = useProjection(valid ? id : 0)
  const update = useUpdateGoal(id)
  const del = useDeleteGoal()
  const addEntry = useAddContribution(id)
  const delEntry = useDeleteContribution(id)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [entry, setEntry] = useState({ amount: '', date: todayISO(), note: '' })
  const [entryErrors, setEntryErrors] = useState<Errors<ContributionField>>({})

  const [monthly, setMonthly] = useState('')
  const debouncedMonthly = useDebounced(monthly)
  const monthlyOk = debouncedMonthly !== '' && Number(debouncedMonthly) >= 0 && Number(debouncedMonthly) <= 1_000_000
  const whatIf = useQuery({
    queryKey: ['goals', id, 'what-if', debouncedMonthly, goal.data?.current_amount],
    queryFn: () => fetchWhatIf(id, debouncedMonthly),
    enabled: valid && monthlyOk && !!goal.data,
  })

  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft

  if (!valid || (goal.isError && axios.isAxiosError(goal.error) && goal.error.response?.status === 404)) {
    return (
      <div className="space-y-4 text-center">
        <p>{t('goalNotFound')}</p>
        <Link to="/" className="btn-ghost">
          {t('backToGoals')}
        </Link>
      </div>
    )
  }
  if (goal.isPending) return <p role="status" className="text-center text-slate-400">{t('loading')}</p>
  if (goal.isError)
    return (
      <div role="alert" className="card text-center">
        <p className="mb-3 text-red-300">{t(errorKey(goal.error))}</p>
        <button className="btn-ghost" onClick={() => void goal.refetch()}>{t('retry')}</button>
      </div>
    )

  const g = goal.data
  const onError = (e: unknown) => toast.show(t(errorKey(e)), 'error')

  const submitEntry = (e: FormEvent) => {
    e.preventDefault()
    const found = validateContribution(entry)
    setEntryErrors(found)
    if (Object.keys(found).length) return
    addEntry.mutate(
      { amount: entry.amount.trim(), date: entry.date || undefined, note: entry.note.trim() },
      {
        onSuccess: () => {
          setEntry({ amount: '', date: todayISO(), note: '' })
          toast.show(t('entryAdded'))
        },
        onError,
      },
    )
  }

  return (
    <div className="space-y-8">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <Back size={16} aria-hidden />
        {t('backToGoals')}
      </Link>

      <section className="card space-y-5">
        {editing ? (
          <>
            <h1 className="text-xl font-semibold">{t('editGoal')}</h1>
            <GoalForm
              hideCurrent
              initial={{
                title: g.title,
                targetAmount: String(Number(g.target_amount)),
                currentAmount: '',
                targetDate: g.target_date,
                annualReturn: String(g.annual_return_pct),
              }}
              submitLabel={t('save')}
              busyLabel={t('loading')}
              busy={update.isPending}
              onCancel={() => setEditing(false)}
              onSubmit={(body) =>
                update.mutate(
                  { title: body.title, target_amount: body.target_amount, target_date: body.target_date, annual_return_pct: body.annual_return_pct },
                  { onSuccess: () => { setEditing(false); toast.show(t('goalUpdated')) }, onError },
                )
              }
            />
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-extrabold">{g.title}</h1>
                <p className="mt-1 text-slate-400">
                  {t('targetLabel')}: {formatMoney(g.target_amount, lang)} · {formatDate(g.target_date, lang)} · {g.months_left} {t('monthsLeft')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={g.status} />
                <button className="btn-ghost px-3! py-1.5!" onClick={() => setEditing(true)} aria-label={t('edit')}>
                  <Pencil size={16} aria-hidden />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-indigo-400">{Math.round(g.progress_pct)}% {t('achieved')}</span>
                <span>{formatMoney(g.current_amount, lang)} / {formatMoney(g.target_amount, lang)}</span>
              </div>
              <ProgressBar pct={g.progress_pct} label={t('progress')} />
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {g.status !== 'completed' && (
                <p className="rounded-xl bg-slate-950 p-4">
                  <span className="block text-slate-400">{t('suggestedDeposit')}</span>
                  <span className="text-2xl font-bold text-emerald-400">{formatMoney(g.suggestion_monthly_deposit, lang)}</span>
                  <span className="ms-1 text-slate-500">{t('perMonth')}</span>
                </p>
              )}
              <p className="rounded-xl bg-slate-950 p-4">
                <span className="block text-slate-400">{t('expectedNow')}</span>
                <span className="text-2xl font-bold">{formatMoney(g.expected_now, lang)}</span>
              </p>
            </div>
          </>
        )}
      </section>

      {projection.data && g.status !== 'completed' && (
        <section className="card" aria-labelledby="chart-h">
          <h2 id="chart-h" className="mb-4 text-xl font-semibold">{t('chartTitle')}</h2>
          <ProjectionChart projection={projection.data} target={g.target_amount} />
        </section>
      )}

      {g.status !== 'completed' && (
        <section className="card space-y-4" aria-labelledby="whatif-h">
          <div>
            <h2 id="whatif-h" className="text-xl font-semibold">{t('whatIf')}</h2>
            <p className="text-sm text-slate-400">{t('whatIfSub')}</p>
          </div>
          <div className="max-w-xs">
            <Field label={t('monthlyDeposit')} type="number" inputMode="decimal" min="0" step="10" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder={String(Math.ceil(Number(g.suggestion_monthly_deposit)))} />
          </div>
          {whatIf.data && monthlyOk && (
            <div role="status" className="space-y-1 rounded-xl bg-slate-950 p-4 text-sm">
              <p className={whatIf.data.reaches_target ? 'font-semibold text-emerald-400' : 'font-semibold text-amber-300'}>
                {whatIf.data.reaches_target ? t('whatIfEnough') : t('whatIfShort')}
              </p>
              <p>{t('balanceAtTarget')}: <strong>{formatMoney(whatIf.data.balance_at_target_date, lang)}</strong></p>
              <p className="text-slate-400">
                {whatIf.data.reach_date ? `${t('reachDate')} ${formatDate(whatIf.data.reach_date, lang)}` : t('neverReach')}
              </p>
            </div>
          )}
        </section>
      )}

      <section className="card space-y-5" aria-labelledby="entries-h">
        <h2 id="entries-h" className="text-xl font-semibold">{t('deposits')}</h2>
        <form onSubmit={submitEntry} noValidate className="grid gap-4 md:grid-cols-4">
          <Field label={t('amount')} type="number" inputMode="decimal" step="0.01" value={entry.amount} onChange={(e) => setEntry({ ...entry, amount: e.target.value })} error={entryErrors.amount} hint={t('amountHint')} />
          <Field label={t('date')} type="date" max={todayISO()} value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })} error={entryErrors.date} style={{ colorScheme: 'dark' }} />
          <div className="md:col-span-2">
            <Field label={t('note')} value={entry.note} maxLength={200} onChange={(e) => setEntry({ ...entry, note: e.target.value })} error={entryErrors.note} />
          </div>
          <button type="submit" className="btn-primary md:col-span-4" disabled={addEntry.isPending}>{t('add')}</button>
        </form>

        {entries.data?.length === 0 && <p className="text-sm text-slate-500">{t('noDeposits')}</p>}
        <ul className="divide-y divide-slate-800">
          {entries.data?.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className={`font-semibold ${Number(c.amount) < 0 ? 'text-red-300' : 'text-emerald-300'}`} dir="ltr">
                  {Number(c.amount) > 0 ? '+' : ''}{formatMoney(c.amount, lang)}
                </p>
                <p className="truncate text-slate-500">{formatDate(c.date, lang)}{c.note ? ` · ${c.note}` : ''}</p>
              </div>
              <button
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-red-400"
                aria-label={`${t('delete')} ${formatDate(c.date, lang)}`}
                onClick={() => delEntry.mutate(c.id, { onSuccess: () => toast.show(t('entryDeleted')), onError })}
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="text-center">
        {confirmDelete ? (
          <div role="alertdialog" aria-label={t('deleteGoal')} className="card mx-auto max-w-md space-y-4 border-red-500/30">
            <p>{t('deleteGoalConfirm')}</p>
            <div className="flex justify-center gap-3">
              <button
                className="btn-danger"
                disabled={del.isPending}
                onClick={() => del.mutate(id, { onSuccess: () => { toast.show(t('goalDeleted')); navigate('/') }, onError })}
              >
                {t('delete')}
              </button>
              <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>{t('cancel')}</button>
            </div>
          </div>
        ) : (
          <button className="text-sm text-slate-500 hover:text-red-400" onClick={() => setConfirmDelete(true)}>
            {t('deleteGoal')}
          </button>
        )}
      </section>
    </div>
  )
}
