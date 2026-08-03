import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Users, ArrowRight, ArrowUp, ArrowDown, Search, Download, Plus } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import AvatarThumb from '../../components/AvatarThumb'
import { downloadMyDataExport } from '../../utils/gdprExport'
import { formatDateShort } from '../../utils/date'

function lastName(displayName) {
  const parts = displayName?.trim().split(' ') ?? []
  return parts[parts.length - 1] ?? ''
}

function parseDateVal(v) {
  if (!v) return null
  const iso = v.length > 10 ? v.replace(' ', 'T') + 'Z' : v + 'T00:00:00'
  return new Date(iso).getTime()
}

// Sloupce tabulky na /trainer/clients — key musí odpovídat poli z GET /clients (viz
// index.php), portalOnly skryje sloupec, když je aktivní filtr "Osobní".
const COLUMNS = [
  { key: 'display_name', label: 'Jméno', labelEn: 'Name' },
  { key: 'current_price_kc', label: 'Tier', labelEn: 'Tier', portalOnly: true },
  { key: 'next_consultation_date', label: 'Příští konzultace', labelEn: 'Next consultation' },
  { key: 'last_feedback_at', label: 'Poslední zpětná vazba', labelEn: 'Last feedback' },
  { key: 'challenge_end_date', label: 'Konec výzvy', labelEn: 'Challenge end' },
  { key: 'last_payment_at', label: 'Poslední platba', labelEn: 'Last payment' },
  { key: 'last_progress_entry_at', label: 'Poslední vstup', labelEn: 'Last progress' },
  { key: 'last_plan_edit_at', label: 'Poslední úprava plánu', labelEn: 'Last plan edit' },
]

export default function TrainerDashboard() {
  const { t, lang } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const [clients, setClients] = useState([])
  const [query, setQuery] = useState('')
  // "portal" je záměrně výchozí — po přihlášení má David rovnou vidět portálové klienty
  // (viz homePath() v api/client.js, Overview.jsx je landing page, sem se přichází z ní).
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'portal')
  // sort.key === null → výchozí řazení (Portál podle ceny sestupně, Osobní/Vše podle jména).
  // Nastaví se buď kliknutím na hlavičku sloupce, nebo příchodem z Overview.jsx přes
  // ?sort=&dir= (obousměrná synchronizace, na rozdíl od jednosměrného ?tab= v ClientDetail.jsx).
  const [sort, setSort] = useState({ key: searchParams.get('sort') || null, dir: searchParams.get('dir') || 'asc' })
  const [showNewForm, setShowNewForm] = useState(false)
  const [newClient, setNewClient] = useState({ email: '', display_name: '', phone: '', client_type: 'personal' })

  useEffect(() => {
    const params = { type: typeFilter }
    if (sort.key) { params.sort = sort.key; params.dir = sort.dir }
    setSearchParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, sort.key, sort.dir])

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
  // bez předplatného padají na konec. Tohle je výchozí řazení, dokud uživatel neklikne na
  // hlavičku sloupce (viz compareBy níže).
  const byPriceDesc = useCallback((a, b) => {
    const pa = a.current_price_kc, pb = b.current_price_kc
    if (pa == null && pb == null) return byName(a, b)
    if (pa == null) return 1
    if (pb == null) return -1
    return pb - pa || byName(a, b)
  }, [byName])

  // Obecný komparátor pro kliknutí na hlavičku libovolného sloupce — jméno a cena mají
  // vlastní logiku, zbytek (datumové signály) se řadí jednotně s null vždy na konci.
  const compareBy = useCallback((key, dir) => (a, b) => {
    if (key === 'display_name') return dir === 'asc' ? byName(a, b) : byName(b, a)
    if (key === 'current_price_kc') {
      const pa = a.current_price_kc, pb = b.current_price_kc
      if (pa == null && pb == null) return byName(a, b)
      if (pa == null) return 1
      if (pb == null) return -1
      return dir === 'asc' ? pa - pb : pb - pa
    }
    // Datumové "staleness" signály: null = "nikdy" = při asc (SIGNAL_META na Overview.jsx
    // vždy používá asc — "nejvíc pozornosti nejdřív") patří úplně nahoru, ne dolů, jinak by
    // proklik z dashboardu schoval přesně ty klienty, které měl zvýraznit.
    const va = parseDateVal(a[key]), vb = parseDateVal(b[key])
    if (va == null && vb == null) return byName(a, b)
    if (va == null) return dir === 'asc' ? -1 : 1
    if (vb == null) return dir === 'asc' ? 1 : -1
    return dir === 'asc' ? va - vb : vb - va
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

  const sortFn = useMemo(
    () => (sort.key ? compareBy(sort.key, sort.dir) : null),
    [sort.key, sort.dir, compareBy]
  )

  const portalClients = useMemo(
    () => filteredByQuery.filter((c) => c.client_type === 'portal').slice().sort(sortFn || byPriceDesc),
    [filteredByQuery, sortFn, byPriceDesc]
  )
  const personalClients = useMemo(
    () => filteredByQuery.filter((c) => c.client_type === 'personal').slice().sort(sortFn || byName),
    [filteredByQuery, sortFn, byName]
  )
  const visibleClients = useMemo(() => {
    if (typeFilter === 'portal') return portalClients
    if (typeFilter === 'personal') return personalClients
    return filteredByQuery.slice().sort(sortFn || byName)
  }, [typeFilter, portalClients, personalClients, filteredByQuery, sortFn, byName])

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      return { key, dir: key === 'current_price_kc' ? 'desc' : 'asc' }
    })
  }

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
            <ClientTable clients={portalClients} t={t} portal sort={sort} onSort={toggleSort} />
          </section>
          <section>
            <h2 className="text-lg mb-3 text-neutral-300">{t('Osobní', 'Personal')}</h2>
            <ClientTable clients={personalClients} t={t} sort={sort} onSort={toggleSort} />
          </section>
        </>
      ) : (
        <ClientTable clients={visibleClients} t={t} portal={typeFilter === 'portal'} sort={sort} onSort={toggleSort} />
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

function formatCellDate(value) {
  if (!value) return '—'
  return formatDateShort(value.slice(0, 10))
}

function ClientTable({ clients, t, portal, sort, onSort }) {
  const columns = COLUMNS.filter((c) => !c.portalOnly || portal)

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800">
            {columns.map((col) => (
              <th key={col.key} className="text-left font-medium text-neutral-400 whitespace-nowrap p-0">
                <button
                  onClick={() => onSort(col.key)}
                  className="flex items-center gap-1 px-4 py-3 hover:text-white transition-colors w-full"
                >
                  {t(col.label, col.labelEn)}
                  {sort.key === col.key && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </button>
              </th>
            ))}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/50 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                  {col.key === 'display_name' ? (
                    <Link to={`/trainer/clients/${c.id}`} className="flex items-center gap-2 font-medium hover:text-blood-500">
                      <AvatarThumb userId={c.id} hasAvatar={!!c.has_avatar} size={28} />
                      {c.display_name}
                    </Link>
                  ) : col.key === 'current_price_kc' ? (
                    <span className="text-xs uppercase tracking-wide text-blood-400 border border-blood-800 rounded px-1.5 py-0.5">
                      {c.current_tier || (c.current_price_kc ? `${c.current_price_kc} Kč` : t('Portál', 'Portal'))}
                    </span>
                  ) : (
                    <span className="text-neutral-400">{formatCellDate(c[col.key])}</span>
                  )}
                </td>
              ))}
              <td className="px-4 py-3 text-right">
                <Link to={`/trainer/clients/${c.id}`}><ArrowRight className="text-neutral-600 hover:text-blood-600" size={16} /></Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {clients.length === 0 && <p className="text-neutral-500 text-sm p-4">{t('Žádní klienti v této kategorii.', 'No clients in this category.')}</p>}
    </div>
  )
}
