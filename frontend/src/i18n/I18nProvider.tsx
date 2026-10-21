import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, type I18nValue } from './context'
import { strings, type Lang, type StringKey } from './strings'

const STORAGE_KEY = 'planit.lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'he' || saved === 'en') return saved
  } catch {
    /* storage unavailable (private mode) – fall through */
  }
  return 'he'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang)
  const dir = lang === 'he' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  const toggleLang = useCallback(() => {
    setLang((l) => {
      const next: Lang = l === 'he' ? 'en' : 'he'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const value = useMemo<I18nValue>(
    () => ({ lang, dir, toggleLang, t: (key: StringKey) => strings[lang][key] }),
    [lang, dir, toggleLang],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
