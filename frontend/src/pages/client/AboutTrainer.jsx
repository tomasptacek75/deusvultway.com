import { useEffect, useState } from 'react'
import { Flame, ExternalLink, Music2, HelpCircle } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import YouTubeEmbed from '../../components/YouTubeEmbed'

// Davidova osobní/motivační zóna — stejný content_sections/content_items systém jako
// ContentLibrary, jen filtrované na kind='about_me' a s vlastním renderem pro 'qa'/'playlist'.
export default function AboutTrainer() {
  const { t } = useLanguage()
  const [sections, setSections] = useState([])

  useEffect(() => {
    apiClient.get('/content-sections').then((r) => setSections(r.data.filter((s) => s.kind === 'about_me')))
  }, [])

  return (
    <div>
      <h1 className="text-3xl mb-8 flex items-center gap-3">
        <Flame className="text-blood-600" /> {t('O Davidovi', 'About David')}
      </h1>

      <div className="space-y-10">
        {sections.map((s) => (
          <section key={s.id}>
            <h2 className="text-lg mb-3 text-neutral-300">{t(s.title, s.title_en || s.title)}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {s.items.map((item) => <ContentItemCard key={item.id} item={item} t={t} />)}
              {s.items.length === 0 && <p className="text-neutral-500 text-sm col-span-full">{t('Zatím žádný obsah v této sekci.', 'No content in this section yet.')}</p>}
            </div>
          </section>
        ))}
        {sections.length === 0 && <p className="text-neutral-500">{t('Tahle sekce je zatím prázdná.', 'This section is empty for now.')}</p>}
      </div>
    </div>
  )
}

function ContentItemCard({ item, t }) {
  if (item.type === 'qa') {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 sm:col-span-2 lg:col-span-1">
        <div className="flex items-start gap-2 mb-2">
          <HelpCircle size={16} className="text-blood-500 shrink-0 mt-0.5" />
          <div className="font-semibold">{t(item.title, item.title_en || item.title)}</div>
        </div>
        {item.body && <p className="text-sm text-neutral-400">{t(item.body, item.body_en || item.body)}</p>}
      </div>
    )
  }

  if (item.type === 'playlist') {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="font-semibold mb-1">{t(item.title, item.title_en || item.title)}</div>
        {item.body && <p className="text-sm text-neutral-400 mb-3">{t(item.body, item.body_en || item.body)}</p>}
        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-blood-500 hover:underline w-fit">
            <Music2 size={14} /> {t('Otevřít playlist', 'Open playlist')}
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="font-semibold mb-1">{t(item.title, item.title_en || item.title)}</div>
      {item.type === 'video' && item.url ? (
        <div className="mb-3">
          <YouTubeEmbed url={item.url} label={t('Otevřít video', 'Open video')} />
        </div>
      ) : null}
      {item.body && <p className="text-sm text-neutral-400 mb-3">{t(item.body, item.body_en || item.body)}</p>}
      {item.url && item.type !== 'video' && (
        <a href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-blood-500 hover:underline w-fit">
          <ExternalLink size={14} /> {t('Otevřít', 'Open')}
        </a>
      )}
    </div>
  )
}
