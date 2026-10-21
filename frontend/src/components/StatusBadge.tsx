import { CheckCircle2, AlertTriangle, XCircle, TrendingUp } from 'lucide-react'
import type { GoalStatus } from '../api/types'
import { useI18n } from '../i18n/context'
import type { StringKey } from '../i18n/strings'

const STYLE: Record<GoalStatus, { cls: string; Icon: typeof TrendingUp }> = {
  completed: { cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', Icon: CheckCircle2 },
  on_track: { cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', Icon: TrendingUp },
  at_risk: { cls: 'border-amber-400/30 bg-amber-400/10 text-amber-300', Icon: AlertTriangle },
  off_track: { cls: 'border-red-400/30 bg-red-400/10 text-red-300', Icon: XCircle },
}

/** Status is conveyed by icon + text, never by colour alone. */
export function StatusBadge({ status }: { status: GoalStatus }) {
  const { t } = useI18n()
  const { cls, Icon } = STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>
      <Icon size={14} aria-hidden />
      {t(`status_${status}` as StringKey)}
    </span>
  )
}
