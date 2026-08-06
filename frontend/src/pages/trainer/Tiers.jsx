import { useEffect, useState } from 'react'
import { Layers, Plus, Pencil, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'

const emptyTierForm = { name: '', name_en: '', price_kc: '', order_num: 0, max_clients: '' }
const emptyServiceForm = { name: '', name_en: '' }

// Spravovaný katalog cenových tierů a jednotlivých služeb v nich (viz db.php gate 8) —
// stejný vzor jako Equipment.jsx (Posilovny/Vybavení): tier má vlastní zaškrtávací seznam
// služeb, ne sdílený se všemi ostatními. Bez vlastní položky v hlavním menu, dosažitelné
// odkazem z ClientDetail.jsx Billing tabu a z filtru na /trainer/clients. Skrýt, nikdy
// smazat: PUT s active=0/1.
export default function Tiers() {
  const { t } = useLanguage()
  const [tiers, setTiers] = useState([])
  const [services, setServices] = useState([])
  const [showTierForm, setShowTierForm] = useState(false)
  const [tierForm, setTierForm] = useState(emptyTierForm)
  const [showSvcForm, setShowSvcForm] = useState(false)
  const [svcForm, setSvcForm] = useState(emptyServiceForm)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyServiceForm)
  const [expandedTier, setExpandedTier] = useState(null)

  function load() {
    apiClient.get('/subscription-tiers', { params: { include_inactive: 1 } }).then((r) => setTiers(r.data))
    apiClient.get('/tier-services', { params: { include_inactive: 1 } }).then((r) => setServices(r.data))
  }

  useEffect(load, [])

  async function createTier(e) {
    e.preventDefault()
    await apiClient.post('/subscription-tiers', { ...tierForm, price_kc: tierForm.price_kc || null, max_clients: tierForm.max_clients || null })
    setTierForm(emptyTierForm)
    setShowTierForm(false)
    load()
  }

  async function toggleTierActive(tier) {
    await apiClient.put(`/subscription-tiers/${tier.id}`, { active: tier.active ? 0 : 1 })
    load()
  }

  async function updateMaxClients(tier, value) {
    await apiClient.put(`/subscription-tiers/${tier.id}`, { max_clients: value === '' ? null : Number(value) })
    load()
  }

  async function createService(e) {
    e.preventDefault()
    await apiClient.post('/tier-services', svcForm)
    setSvcForm(emptyServiceForm)
    setShowSvcForm(false)
    load()
  }

  async function toggleServiceActive(item) {
    await apiClient.put(`/tier-services/${item.id}`, { active: item.active ? 0 : 1 })
    load()
  }

  function startEdit(item) {
    setEditingId(item.id)
    setEditForm({ name: item.name, name_en: item.name_en ?? '' })
  }

  async function saveEdit(e) {
    e.preventDefault()
    await apiClient.put(`/tier-services/${editingId}`, editForm)
    setEditingId(null)
    load()
  }

  return (
    <div>
      <h1 className="text-3xl mb-6 flex items-center gap-3">
        <Layers className="text-blood-600" /> {t('Tiery', 'Tiers')}
      </h1>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg text-neutral-300">{t('Cenové tiery', 'Pricing tiers')}</h2>
        <button
          onClick={() => setShowTierForm((s) => !s)}
          className="flex items-center gap-1.5 bg-blood-700 hover:bg-blood-600 transition-colors px-3 py-1.5 rounded-md text-sm font-medium"
        >
          <Plus size={16} /> {t('Nový tier', 'New tier')}
        </button>
      </div>

      {showTierForm && (
        <form onSubmit={createTier} className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4 flex flex-wrap gap-3">
          <input
            required
            placeholder={t('Název', 'Name')}
            value={tierForm.name}
            onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
            className="flex-1 min-w-[10rem] bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder={t('Anglický název (volitelné)', 'English name (optional)')}
            value={tierForm.name_en}
            onChange={(e) => setTierForm({ ...tierForm, name_en: e.target.value })}
            className="flex-1 min-w-[10rem] bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder={t('Cena (Kč)', 'Price (Kč)')}
            value={tierForm.price_kc}
            onChange={(e) => setTierForm({ ...tierForm, price_kc: e.target.value })}
            className="w-32 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="1"
            placeholder={t('Max klientů (VIP limit, volitelné)', 'Max clients (VIP cap, optional)')}
            value={tierForm.max_clients}
            onChange={(e) => setTierForm({ ...tierForm, max_clients: e.target.value })}
            className="w-56 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-blood-700 hover:bg-blood-600 transition-colors px-4 py-2 rounded-md text-sm font-medium">
            {t('Uložit', 'Save')}
          </button>
        </form>
      )}

      <div className="space-y-3 mb-10">
        {tiers.map((tier) => (
          <div key={tier.id} className={`rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden ${tier.active ? '' : 'opacity-50'}`}>
            <div className="flex items-center justify-between p-4">
              <button
                onClick={() => setExpandedTier(expandedTier === tier.id ? null : tier.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                {expandedTier === tier.id ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
                <span className="font-semibold truncate">{t(tier.name, tier.name_en || tier.name)}</span>
                {tier.price_kc != null && <span className="text-xs text-neutral-500 shrink-0">{tier.price_kc} Kč</span>}
                {tier.max_clients != null && (
                  <span className="text-xs text-amber-400 shrink-0">{tier.active_count ?? 0}/{tier.max_clients} {t('obsazeno', 'filled')}</span>
                )}
              </button>
              <label className="flex items-center gap-1.5 text-xs text-neutral-500 shrink-0 mr-2" title={t('VIP limit — kolik klientů může mít tenhle tier max najednou', 'VIP cap — max clients allowed in this tier at once')}>
                {t('Limit', 'Cap')}
                <input
                  type="number"
                  min="1"
                  defaultValue={tier.max_clients ?? ''}
                  onBlur={(e) => updateMaxClients(tier, e.target.value)}
                  placeholder="—"
                  className="w-14 bg-neutral-950 border border-neutral-800 rounded-md px-1.5 py-1 text-xs"
                />
              </label>
              <button onClick={() => toggleTierActive(tier)} className="text-neutral-600 hover:text-blood-500 shrink-0" title={tier.active ? t('Skrýt', 'Hide') : t('Odkrýt', 'Show')}>
                {tier.active ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            {expandedTier === tier.id && <TierServicesEditor tier={tier} allServices={services} onChange={load} />}
          </div>
        ))}
        {tiers.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím žádné tiery.', 'No tiers yet.')}</p>}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg text-neutral-300">{t('Služby', 'Services')}</h2>
        <button
          onClick={() => setShowSvcForm((s) => !s)}
          className="flex items-center gap-1.5 bg-blood-700 hover:bg-blood-600 transition-colors px-3 py-1.5 rounded-md text-sm font-medium"
        >
          <Plus size={16} /> {t('Nová služba', 'New service')}
        </button>
      </div>

      {showSvcForm && (
        <form onSubmit={createService} className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4 flex flex-wrap gap-3">
          <input
            required
            placeholder={t('Název', 'Name')}
            value={svcForm.name}
            onChange={(e) => setSvcForm({ ...svcForm, name: e.target.value })}
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder={t('Anglický název (volitelné)', 'English name (optional)')}
            value={svcForm.name_en}
            onChange={(e) => setSvcForm({ ...svcForm, name_en: e.target.value })}
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-blood-700 hover:bg-blood-600 transition-colors px-4 py-2 rounded-md text-sm font-medium">
            {t('Uložit', 'Save')}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((item) => (
          <div key={item.id} className={`rounded-lg border border-neutral-800 bg-neutral-900 p-4 ${item.active ? '' : 'opacity-50'}`}>
            {editingId === item.id ? (
              <form onSubmit={saveEdit} className="space-y-2">
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
                />
                <input
                  value={editForm.name_en}
                  onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value })}
                  placeholder={t('Anglický název', 'English name')}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-3 py-1.5 text-sm font-medium">
                    {t('Uložit', 'Save')}
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="flex-1 bg-neutral-800 hover:bg-neutral-700 transition-colors rounded-md px-3 py-1.5 text-sm font-medium">
                    {t('Zrušit', 'Cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-medium">{t(item.name, item.name_en || item.name)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(item)} className="text-neutral-600 hover:text-blood-500">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => toggleServiceActive(item)} className="text-neutral-600 hover:text-blood-500" title={item.active ? t('Skrýt', 'Hide') : t('Odkrýt', 'Show')}>
                    {item.active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {services.length === 0 && <p className="text-neutral-500 text-sm col-span-full">{t('Zatím žádné služby.', 'No services yet.')}</p>}
      </div>
    </div>
  )
}

// Zaškrtávací seznam služeb pro konkrétní tier — každý tier má svůj vlastní výběr.
// PUT /subscription-tiers/{id}/services nahrazuje celou množinu najednou (ne
// POST/DELETE po jedné položce jako u gym_equipment), takže se posílá celý nový seznam.
function TierServicesEditor({ tier, allServices, onChange }) {
  const { t } = useLanguage()

  async function toggle(service, checked) {
    const ids = checked ? [...tier.service_ids, service.id] : tier.service_ids.filter((id) => id !== service.id)
    await apiClient.put(`/subscription-tiers/${tier.id}/services`, { service_ids: ids })
    onChange()
  }

  const selectedIds = new Set(tier.service_ids)

  return (
    <div className="border-t border-neutral-800 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
        {t('Služby v tomhle tieru', 'Services in this tier')}
      </div>
      <div className="space-y-2">
        {allServices.filter((s) => s.active).map((service) => (
          <label key={service.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selectedIds.has(service.id)} onChange={(e) => toggle(service, e.target.checked)} />
            {t(service.name, service.name_en || service.name)}
          </label>
        ))}
        {allServices.filter((s) => s.active).length === 0 && (
          <p className="text-neutral-500 text-sm">{t('Nejdřív přidej nějakou službu do katalogu níže.', 'Add some services to the catalog below first.')}</p>
        )}
      </div>
    </div>
  )
}
