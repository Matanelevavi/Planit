import { Link } from 'react-router-dom'
import { Calendar, TrendingUp, Wallet } from 'lucide-react'
import type { Goal } from '../api/types'
import { useI18n } from '../i18n/context'
import { formatDate, formatMoney } from '../lib/format'
import { ProgressBar } from './ProgressBar'
import { StatusBadge } from './StatusBadge'

export function GoalCard({ goal }: { goal: Goal }) {
  const { t, lang } = useI18n()
  return (
    <Link
      to={`/goals/${goal.id}`}
      className="card group block transition-colors hover:border-indigo-500/50"
      aria-label={goal.title}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="rounded-lg bg-slate-800 p-3 transition-colors group-hover:bg-indigo-500/20 group-hover:text-indigo-400">
          <Wallet size={24} aria-hidden />
        </div>
        <div className="text-end">
          <p className="text-2xl font-bold text-white">{formatMoney(goal.target_amount, lang)}</p>
          <p className="text-xs text-slate-500">{t('targetLabel')}</p>
        </div>
      </div>

      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="truncate text-xl font-semibold">{goal.title}</h3>
        <StatusBadge status={goal.status} />
      </div>
      <p className="mb-6 flex items-center gap-2 text-sm text-slate-400">
        <Calendar size={14} aria-hidden />
        {formatDate(goal.target_date, lang)}
        <span className="text-slate-600">·</span>
        {goal.months_left} {t('monthsLeft')}
      </p>

      <div className="space-y-2">
        <div className="flex justify-between text-xs font-medium">
          <span className="text-indigo-400">
            {Math.round(goal.progress_pct)}% {t('achieved')}
          </span>
          <span className="text-slate-300">
            {formatMoney(goal.current_amount, lang, { compact: true })} / {formatMoney(goal.target_amount, lang, { compact: true })}
          </span>
        </div>
        <ProgressBar pct={goal.progress_pct} label={`${goal.title} – ${t('progress')}`} />
      </div>

      {goal.status !== 'completed' && (
        <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('suggestedDeposit')}</span>
          <span className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-400">
            <TrendingUp size={16} aria-hidden />
            <span className="font-bold">
              {formatMoney(goal.suggestion_monthly_deposit, lang)}
              <span className="ms-1 text-xs font-normal text-emerald-400/70">{t('perMonth')}</span>
            </span>
          </span>
        </div>
      )}
    </Link>
  )
}
