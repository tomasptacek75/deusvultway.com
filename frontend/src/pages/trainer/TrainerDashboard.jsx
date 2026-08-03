import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, ArrowRight, Activity, Search, Download, Plus } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import AvatarThumb from '../../components/AvatarThumb'
import { downloadMyDataExport } from '../../utils/gdprExport'

function timeAgo(iso, t) {
  if (!iso) return t('zatím žádná aktivita', 'no activity yet')
  const diffMs = Date.now() - new Date(iso.replace(' ', 'T') + 'Z').getTime()
  const h = Math.floor(diffMs / 3600000)
  if (h < 1) return t('před chvílí', 'just now')
  if (h < 24) return t(`před ${h} h`, `${h}h ago`)
  return t(`před ${Math.floor(h / 24)} d`, `${Math.floor(h / 24)}d ago`)
}

function lastName(displayName) {
  const parts = displayName?.trim().split(' ') ?? []
  return parts[parts.length - 1] ?? ''
}

export default function TrainerDashboard() {
  const { t, lang } = useLanguage()
  const [clients, setClients] = useState([])
  const [query, setQuery] = useState('')
  // "portal" je záměrně výchozí — po přihlášení má David rovnou vidět portálové klienty
  // (viz homePath() v api/client.js).
  const [typeFilter, setTypeFilter] = useState('portal')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newClient, setNewClient] = useState({ email: '', display_name: '', phone: '', client_type: 'personal' })

  function load() {
    apiClient.get('/clients').then((r) => setClients(r.data))
  }

  useEffect(load, [])

  async function createClient(e) {
    e.preventDefault()
    await apiClient.post('/clients', newClient)
    setNewClient({ email: '', display_name: '', phone: '', client_type: 'personal' })
    setShowNewForm(false)
    load()
  }

  const collator = useMemo(() => new Intl.Collator(lang === 'en' ? 'en' : 'cs'), [lang])
  const byName = useCallback((a, b) => collator.compare(lastName(a.display_name), lastName(b.display_name)), [collator])
  // Portál klienti řazení od nejdražšího tieru po nejlevnější (podle price_kc jejich
  // posledního předplatného — tier je volný text, cena je spolehlivější kritérium). Klienti
  // bez předplatného padají na konec.
  const byPriceDesc = useCallback((a, b) => {
    const pa = a.current_price_kc, pb = b.current_price_kc
    if (pa == null && pb == null) return byName(a, b)
    if (pa == null) return 1
    if (pb == null) return -1
    return pb - pa || byName(a, b)
  }, [byName])

  const filteredByQuery = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) =>
      c.display_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q)
    )
  }, [clients, query])

  const portalClients = useMemo(
    () => filteredByQuery.filter((c) => c.client_type === 'portal').slice().sort(byPriceDesc),
    [filteredByQuery, byPriceDesc]
  )
  const personalClients = useMemo(
    () => filteredByQuery.filter((c) => c.client_type === 'personal').slice().sort(byName),
    [filteredByQuery, byName]
  )
  const visibleClients = useMemo(() => {
    if (typeFilter === 'portal') return portalClients
    if (typeFilter === 'personal') return personalClients
    return filteredByQuery.slice().sort(byName)
  }, [typeFilter, portalClients, personalClients, filteredByQuery, byName])

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="text-3xl flex items-center gap-3">
          <Users className="text-blood-600" /> {t('Klienti', 'Clients')}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm"
          >
            <option value="portal">{t('Portál', 'Portal')}</option>
            <option value="personal">{t('Osobní', 'Personal')}</option>
            <option value="all">{t('Vše', 'All')}</option>
          </select>
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Hledat klienta…', 'Search clients…')}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => setShowNewForm((s) => !s)}
            className="flex items-center gap-1.5 bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-3 py-2 text-sm font-medium"
          >
            <Plus size={16} /> {t('Nový klient', 'New client')}
          </button>
        </div>
      </div>

      {showNewForm && (
        <form onSubmit={createClient} className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-5 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            required
            type="email"
            placeholder={t('E-mail', 'Email')}
            value={newClient.email}
            onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
            className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
          />
          <input
            required
            placeholder={t('Jméno', 'Name')}
            value={newClient.display_name}
            onChange={(e) => setNewClient({ ...newClient, display_name: e.target.value })}
            className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
          />
          <input
            placeholder={t('Telefon (nepovinné)', 'Phone (optional)')}
            value={newClient.phone}
            onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
            className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
          />
          <select
            value={newClient.client_type}
            onChange={(e) => setNewClient({ ...newClient, client_type: e.target.value })}
            className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
          >
            <option value="personal">{t('Osobní', 'Personal')}</option>
            <option value="portal">{t('Portál', 'Portal')}</option>
          </select>
          <button type="submit" className="md:col-span-4 bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-4 py-2 font-medium">
            {t('Založit klienta', 'Create client')}
          </button>
        </form>
      )}

      {typeFilter === 'all' ? (
        <>
          <section className="mb-8">
            <h2 className="text-lg mb-3 text-neutral-300">{t('Portál', 'Portal')}</h2>
            <ClientGrid clients={portalClients} t={t} />
          </section>
          <section>
            <h2 className="text-lg mb-3 text-neutral-300">{t('Osobní', 'Personal')}</h2>
            <ClientGrid clients={personalClients} t={t} />
          </section>
        </>
      ) : (
        <ClientGrid clients={visibleClients} t={t} />
      )}
      {clients.length === 0 && <p className="text-neutral-500">{t('Zatím žádní klienti.', 'No clients yet.')}</p>}

      <button
        onClick={downloadMyDataExport}
        className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-400 mt-10"
      >
        <Download size={13} /> {t('Stáhnout moje data (GDPR export)', 'Download my data (GDPR export)')}
      </button>
    </div>
  )
}

function ClientGrid({ clients, t }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {clients.map((c) => (
        <Link
          key={c.id}
          to={`/trainer/clients/${c.id}`}
          className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 hover:border-blood-600 transition-colors flex flex-col gap-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <AvatarThumb userId={c.id} hasAvatar={!!c.has_avatar} size={40} />
              <div className="min-w-0">
                <div className="font-semibold truncate flex items-center gap-2">
                  {c.display_name}
                  {c.client_type === 'portal' && (
                    <span className="text-[10px] uppercase tracking-wide text-blood-400 border border-blood-800 rounded px-1.5 py-0.5 shrink-0">
                      {c.current_tier || t('Portál', 'Portal')}
                    </span>
                  )}
                </div>
                <div className="text-sm text-neutral-500 truncate">{c.phone || c.email}</div>
              </div>
            </div>
            <ArrowRight className="text-neutral-600 group-hover:text-blood-600 shrink-0" size={18} />
          </div>
          <div className="flex items-center justify-between text-xs text-neutral-500 border-t border-neutral-800 pt-3">
            <span className="flex items-center gap-1">
              <Activity size={12} /> {timeAgo(c.summary?.last_activity, t)}
            </span>
            {c.summary?.adherence_pct !== null && c.summary?.adherence_pct !== undefined && (
              <span className={c.summary.adherence_pct >= 70 ? 'text-blood-500' : 'text-neutral-400'}>
                {c.summary.adherence_pct}% adherence
              </span>
            )}
          </div>
        </Link>
      ))}
      {clients.length === 0 && <p className="text-neutral-500 text-sm">{t('Žádní klienti v této kategorii.', 'No clients in this category.')}</p>}
    </div>
  )
}
