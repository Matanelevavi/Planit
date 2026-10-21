import { useState } from 'react'
import { PlusCircle } from 'lucide-react'
import { errorKey } from '../api/client'
import { useCreateGoal, useGoals, useSummary } from '../api/hooks'
import { GoalCard } from '../components/GoalCard'
import { GoalForm } from '../components/GoalForm'
import { useToast } from '../components/toast-context'
import { useI18n } from '../i18n/context'
import { formatMoney } from '../lib/format'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4! text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}

export function Dashboard() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const goals = useGoals()
  const summary = useSummary()
  const create = useCreateGoal()
  const [formKey, setFormKey] = useState(0)

  return (
    <div className="space-y-10">
      <header className="space-y-3 text-center">
        <h1 className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-4xl font-extrabold text-transparent md:text-5xl">
          {t('yourGoals')}
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-400">{t('dashboardSub')}</p>
      </header>

      {summary.data && summary.data.goal_count > 0 && (
        <section aria-label="Summary" className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label={t('summaryGoals')} value={String(summary.data.goal_count)} />
          <Stat label={t('summaryTotal')} value={formatMoney(summary.data.total_current, lang, { compact: true })} />
          <Stat label={t('summaryMonthly')} value={formatMoney(summary.data.total_required_monthly, lang)} />
          <Stat
            label={t('summaryOnTrack')}
            value={`${summary.data.status_counts.on_track + summary.data.status_counts.completed}/${summary.data.goal_count}`}
          />
        </section>
      )}

      <section className="card md:p-8!" aria-labelledby="add-goal">
        <div className="mb-6 flex items-center gap-3">
          <PlusCircle className="text-indigo-400" aria-hidden />
          <h2 id="add-goal" className="text-xl font-semibold">
            {t('addGoal')}
          </h2>
        </div>
        <GoalForm
          key={formKey} // remounting resets the form after a successful create
          submitLabel={t('createGoal')}
          busyLabel={t('creating')}
          busy={create.isPending}
          onSubmit={(body) =>
            create.mutate(body, {
              onSuccess: () => {
                setFormKey((k) => k + 1)
                toast.show(t('goalCreated'))
              },
              onError: (e) => toast.show(t(errorKey(e)), 'error'),
            })
          }
        />
      </section>

      {goals.isPending && (
        <p role="status" className="text-center text-slate-400">
          {t('loading')}
        </p>
      )}
      {goals.isError && (
        <div role="alert" className="card border-red-500/30 text-center">
          <p className="mb-3 text-red-300">{t(errorKey(goals.error))}</p>
          <button className="btn-ghost" onClick={() => void goals.refetch()}>
            {t('retry')}
          </button>
        </div>
      )}
      {goals.data && (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2" aria-label={t('yourGoals')}>
          {goals.data.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
          {goals.data.length === 0 && (
            <p className="col-span-full rounded-2xl border-2 border-dashed border-slate-800 py-12 text-center text-slate-500">
              {t('noGoals')}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
