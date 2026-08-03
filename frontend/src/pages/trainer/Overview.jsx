import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, ArrowRight } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import { attentionSignals, SIGNAL_META } from '../../utils/clientHealth'

// Landing page pro trenéra (viz homePath() v api/client.js) — přehled počtů "potřebuje
// pozornost" napříč Portál/Osobní klienty, proklik na číslo přenese na /trainer/clients
// s odpovídajícím řazením (viz TrainerDashboard.jsx's ?sort=&dir= synchronizace).
export default function Overview() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [clients, setClients] = useState(null)

  useEffect(() => {
    apiClient.get('/clients').then((r) => setClients(r.data))
  }, [])

  if (!clients) return null

  const portal = clients.filter((c) => c.client_type === 'portal')
  const personal = clients.filter((c) => c.client_type === 'personal')

  function goTo(type, signalKey) {
    const meta = SIGNAL_META[signalKey]
    navigate(`/trainer/clients?type=${type}&sort=${meta.sortKey}&dir=${meta.dir}`)
  }

  return (
    <div>
      <h1 className="text-3xl mb-8 flex items-center gap-3">
        <LayoutDashboard className="text-blood-600" /> {t('Přehled', 'Overview')}
      </h1>
      <div className="space-y-10">
        <ClientHealthSection title={t('Portál', 'Portal')} clients={portal} type="portal" t={t} onSignalClick={goTo} />
        <ClientHealthSection title={t('Osobní', 'Personal')} clients={personal} type="personal" t={t} onSignalClick={goTo} />
      </div>
    </div>
  )
}

function ClientHealthSection({ title, clients, type, t, onSignalClick }) {
  const counts = Object.fromEntries(Object.keys(SIGNAL_META).map((k) => [k, 0]))
  for (const c of clients) {
    for (const signal of attentionSignals(c)) counts[signal] += 1
  }

  return (
    <section>
      <h2 className="text-lg mb-3 text-neutral-300">
        {title} <span className="text-neutral-500 font-normal">({clients.length})</span>
      </h2>
      {clients.length === 0 ? (
        <p className="text-neutral-500 text-sm">{t('Zatím žádní klienti v této kategorii.', 'No clients in this category yet.')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(SIGNAL_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => onSignalClick(type, key)}
              className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-4 hover:border-blood-600 transition-colors text-left"
            >
              <div>
                <div className="text-2xl font-display">{counts[key]}</div>
                <div className="text-sm text-neutral-400">{t(meta.label, meta.labelEn)}</div>
              </div>
              <ArrowRight className="text-neutral-600" size={16} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
