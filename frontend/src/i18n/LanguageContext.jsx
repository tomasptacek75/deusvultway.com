import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const LanguageContext = createContext(null)

// t(czech, english) — anglický text se dodává přímo u volání, ne přes samostatný slovníkový
// soubor. U appky téhle velikosti je to rychlejší na údržbu (překlad je vidět hned vedle
// originálu) a chybějící překlad je na první pohled vidět v kódu, ne až za běhu jako
// tichý fallback na klíč.
//
// t/toggle/value jsou memoizované na `lang`, ne vytvářené znovu při každém renderu — jinak
// by komponenty s `useEffect([..., t])` (např. NotificationBell polling) zbytečně re-spouštěly
// efekt při každém re-renderu providera (třeba při navigaci uvnitř BrowserRouteru).
export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('bg_lang') || 'en')

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'cs' ? 'en' : 'cs'
      localStorage.setItem('bg_lang', next)
      return next
    })
  }, [])

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const t = useCallback((cs, en) => (lang === 'en' ? en : cs), [lang])
  const value = useMemo(() => ({ lang, toggle, t }), [lang, toggle, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
