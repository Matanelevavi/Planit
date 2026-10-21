import type { Lang } from '../i18n/strings'

const locale = (lang: Lang) => (lang === 'he' ? 'he-IL' : 'en-IL')

/** The API serialises money as decimal strings ("1234.50"). */
export function toNumber(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export function formatMoney(value: string | number, lang: Lang, opts: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat(locale(lang), {
    style: 'currency',
    currency: 'ILS',
    // compact amounts keep one decimal so 1.5M doesn't read as 2M
    maximumFractionDigits: opts.compact ? 1 : 0,
    ...(opts.compact ? { notation: 'compact', compactDisplay: 'short' } : {}),
  }).format(toNumber(value))
}

/** "2029-11-30" -> "30.11.2029" (he) / "30/11/2029" (en). Parsed manually to avoid timezone shifts. */
export function formatDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(Date.UTC(y, m - 1, d))
  return new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
