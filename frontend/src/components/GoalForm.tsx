import { useState, type FormEvent } from 'react'
import { Calendar, DollarSign, Target, TrendingUp } from 'lucide-react'
import type { GoalCreateBody } from '../api/types'
import { useI18n } from '../i18n/context'
import { EMPTY_GOAL, validateGoal, type GoalFormValues } from '../lib/validation'
import { Field } from './Field'

interface Props {
  initial?: GoalFormValues
  submitLabel: string
  busyLabel: string
  busy: boolean
  /** Hide "already saved" when editing – the balance is managed through deposits. */
  hideCurrent?: boolean
  onSubmit: (body: GoalCreateBody) => void
  onCancel?: () => void
}

export function GoalForm({ initial = EMPTY_GOAL, submitLabel, busyLabel, busy, hideCurrent, onSubmit, onCancel }: Props) {
  const { t } = useI18n()
  const [v, setV] = useState<GoalFormValues>(initial)
  const [errors, setErrors] = useState<ReturnType<typeof validateGoal>>({})
  const set = (k: keyof GoalFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const found = validateGoal(hideCurrent ? { ...v, currentAmount: '' } : v)
    setErrors(found)
    if (Object.keys(found).length) return
    onSubmit({
      title: v.title.trim(),
      target_amount: v.targetAmount.trim(),
      current_amount: v.currentAmount.trim() || '0',
      target_date: v.targetDate,
      annual_return_pct: Number(v.annualReturn),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <div className="md:col-span-2">
        <Field label={t('goalTitle')} icon={<Target size={18} />} value={v.title} onChange={set('title')} error={errors.title} placeholder={t('goalTitlePlaceholder')} maxLength={100} autoComplete="off" />
      </div>
      <Field label={t('targetAmount')} icon={<DollarSign size={18} />} type="number" inputMode="decimal" min="1" step="0.01" value={v.targetAmount} onChange={set('targetAmount')} error={errors.targetAmount} placeholder="100000" />
      <Field label={t('targetDate')} icon={<Calendar size={18} />} type="date" value={v.targetDate} onChange={set('targetDate')} error={errors.targetDate} style={{ colorScheme: 'dark' }} />
      {!hideCurrent && (
        <Field label={t('currentAmount')} icon={<DollarSign size={18} />} type="number" inputMode="decimal" min="0" step="0.01" value={v.currentAmount} onChange={set('currentAmount')} error={errors.currentAmount} placeholder="0" />
      )}
      <Field label={t('expectedReturn')} icon={<TrendingUp size={18} />} type="number" inputMode="decimal" min="0" max="20" step="0.1" value={v.annualReturn} onChange={set('annualReturn')} error={errors.annualReturn} />
      <div className="flex gap-3 md:col-span-4">
        <button type="submit" disabled={busy} className="btn-primary flex-1">
          {busy ? busyLabel : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            {t('cancel')}
          </button>
        )}
      </div>
    </form>
  )
}
