import { createContext, useContext } from 'react'
import type { Lang, StringKey } from './strings'

export interface I18nValue {
  lang: Lang
  dir: 'rtl' | 'ltr'
  t: (key: StringKey) => string
  toggleLang: () => void
}

export const I18nContext = createContext<I18nValue | null>(null)

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
