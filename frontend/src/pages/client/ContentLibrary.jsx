import { useEffect, useState } from 'react'
import { BookOpen, ExternalLink } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'

// Read-only knihovna (video ukázky, strava, playlisty) — viditelná všem klientům stejně,
// žádné rozlišení podle client_type. Jen aktivní sekce/položky (backend už filtruje).
export default function ContentLibrary() {
  const { t } = useLanguage()
  const [sections, setSections] = useState([])

  useEffect(() => {
    apiClient.get('/content-sections').then((r) => setSections(r.data))
  }, [])

  return (
    <div>
      <h1 className="text-3xl mb-8 flex items-center gap-3">
        <BookOpen className="text-blood-600" /> {t('Knihovna', 'Library')}
      </h1>

      <div className="space-y-10">
        {sections.map((s) => (
          <section key={s.id}>
            <h2 className="text-lg mb-3 text-neutral-300">{t(s.title, s.title_en || s.title)}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {s.items.map((item) => (
                <div key={item.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
                  <div className="text-xs text-blood-500 uppercase tracking-wide mb-1">{item.type}</div>
                  <div className="font-semibold mb-1">{t(item.title, item.title_en || item.title)}</div>
                  {item.body && <p className="text-sm text-neutral-400 mb-3">{t(item.body, item.body_en || item.body)}</p>}
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-blood-500 hover:underline w-fit">
                      <ExternalLink size={14} /> {t('Otevřít', 'Open')}
                    </a>
                  )}
                </div>
              ))}
              {s.items.length === 0 && <p className="text-neutral-500 text-sm col-span-full">{t('Zatím žádný obsah v této sekci.', 'No content in this section yet.')}</p>}
            </div>
          </section>
        ))}
        {sections.length === 0 && <p className="text-neutral-500">{t('Knihovna je zatím prázdná.', 'The library is empty for now.')}</p>}
      </div>
    </div>
  )
}
