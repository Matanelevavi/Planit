import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { useI18n } from '../i18n/context'
import type { StringKey } from '../i18n/strings'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error?: StringKey
  hint?: string
  icon?: ReactNode
}

/** Labelled input with an accessible error message; `icon` sits at the inline start (RTL-aware). */
export function Field({ label, error, hint, icon, className = '', ...input }: FieldProps) {
  const id = useId()
  const { t } = useI18n()
  const describedBy = [error ? `${id}-err` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute start-3 top-3 text-slate-500">{icon}</span>}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`input ${icon ? 'ps-10' : ''} ${error ? 'ring-2 ring-red-500/60' : ''} ${className}`}
          {...input}
        />
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-red-400">
          {t(error)}
        </p>
      )}
    </div>
  )
}
