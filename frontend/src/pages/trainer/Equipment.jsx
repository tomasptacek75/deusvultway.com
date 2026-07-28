import { useEffect, useState } from 'react'
import { Dumbbell, Plus, Pencil, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'

const emptyForm = { name: '', name_en: '' }

// Spravovaný seznam posiloven a katalog vybavení pro portálové klienty (výběr ze seznamu, ne
// volný text — viz ClientDetail.jsx EquipmentTab). Každá posilovna má vlastní seznam vybavení
// (gym_equipment), protože různé posilovny mají různé vybavení — není to jeden společný
// zaškrtávací seznam. Skrýt, nikdy smazat: PUT s active=0/1 místo DELETE.
export default function Equipment() {
  const { t } = useLanguage()
  const [gyms, setGyms] = useState([])
  const [equipment, setEquipment] = useState([])
  const [showGymForm, setShowGymForm] = useState(false)
  const [gymForm, setGymForm] = useState(emptyForm)
  const [showEqForm, setShowEqForm] = useState(false)
  const [eqForm, setEqForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [expandedGym, setExpandedGym] = useState(null)

  function load() {
    apiClient.get('/gyms', { params: { include_inactive: 1 } }).then((r) => setGyms(r.data))
    apiClient.get('/equipment-options', { params: { include_inactive: 1 } }).then((r) => setEquipment(r.data))
  }

  useEffect(load, [])

  async function createGym(e) {
    e.preventDefault()
    await apiClient.post('/gyms', gymForm)
    setGymForm(emptyForm)
    setShowGymForm(false)
    load()
  }

  async function toggleGymActive(gym) {
    await apiClient.put(`/gyms/${gym.id}`, { active: gym.active ? 0 : 1 })
    load()
  }

  async function createEquipment(e) {
    e.preventDefault()
    await apiClient.post('/equipment-options', eqForm)
    setEqForm(emptyForm)
    setShowEqForm(false)
    load()
  }

  async function toggleEquipmentActive(item) {
    await apiClient.put(`/equipment-options/${item.id}`, { active: item.active ? 0 : 1 })
    load()
  }

  function startEdit(item) {
    setEditingId(item.id)
    setEditForm({ name: item.name, name_en: item.name_en ?? '' })
  }

  async function saveEdit(e) {
    e.preventDefault()
    await apiClient.put(`/equipment-options/${editingId}`, editForm)
    setEditingId(null)
    load()
  }

  return (
    <div>
      <h1 className="text-3xl mb-6 flex items-center gap-3">
        <Dumbbell className="text-blood-600" /> {t('Vybavení', 'Equipment')}
      </h1>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg text-neutral-300">{t('Posilovny', 'Gyms')}</h2>
        <button
          onClick={() => setShowGymForm((s) => !s)}
          className="flex items-center gap-1.5 bg-blood-700 hover:bg-blood-600 transition-colors px-3 py-1.5 rounded-md text-sm font-medium"
        >
          <Plus size={16} /> {t('Nová posilovna', 'New gym')}
        </button>
      </div>

      {showGymForm && (
        <form onSubmit={createGym} className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4 flex flex-wrap gap-3">
          <input
            required
            placeholder={t('Název posilovny', 'Gym name')}
            value={gymForm.name}
            onChange={(e) => setGymForm({ ...gymForm, name: e.target.value })}
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder={t('Anglický název (volitelné)', 'English name (optional)')}
            value={gymForm.name_en}
            onChange={(e) => setGymForm({ ...gymForm, name_en: e.target.value })}
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-blood-700 hover:bg-blood-600 transition-colors px-4 py-2 rounded-md text-sm font-medium">
            {t('Uložit', 'Save')}
          </button>
        </form>
      )}

      <div className="space-y-3 mb-10">
        {gyms.map((gym) => (
          <div key={gym.id} className={`rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden ${gym.active ? '' : 'opacity-50'}`}>
            <div className="flex items-center justify-between p-4">
              <button
                onClick={() => setExpandedGym(expandedGym === gym.id ? null : gym.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                {expandedGym === gym.id ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
                <span className="font-semibold truncate">{t(gym.name, gym.name_en || gym.name)}</span>
              </button>
              <button onClick={() => toggleGymActive(gym)} className="text-neutral-600 hover:text-blood-500 shrink-0" title={gym.active ? t('Skrýt', 'Hide') : t('Odkrýt', 'Show')}>
                {gym.active ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            {expandedGym === gym.id && <GymEquipmentEditor gym={gym} allEquipment={equipment} />}
          </div>
        ))}
        {gyms.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím žádné posilovny.', 'No gyms yet.')}</p>}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg text-neutral-300">{t('Vybavení', 'Equipment')}</h2>
        <button
          onClick={() => setShowEqForm((s) => !s)}
          className="flex items-center gap-1.5 bg-blood-700 hover:bg-blood-600 transition-colors px-3 py-1.5 rounded-md text-sm font-medium"
        >
          <Plus size={16} /> {t('Nová položka', 'New item')}
        </button>
      </div>

      {showEqForm && (
        <form onSubmit={createEquipment} className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4 flex flex-wrap gap-3">
          <input
            required
            placeholder={t('Název', 'Name')}
            value={eqForm.name}
            onChange={(e) => setEqForm({ ...eqForm, name: e.target.value })}
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder={t('Anglický název (volitelné)', 'English name (optional)')}
            value={eqForm.name_en}
            onChange={(e) => setEqForm({ ...eqForm, name_en: e.target.value })}
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-blood-700 hover:bg-blood-600 transition-colors px-4 py-2 rounded-md text-sm font-medium">
            {t('Uložit', 'Save')}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {equipment.map((item) => (
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
                  <button onClick={() => toggleEquipmentActive(item)} className="text-neutral-600 hover:text-blood-500" title={item.active ? t('Skrýt', 'Hide') : t('Odkrýt', 'Show')}>
                    {item.active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {equipment.length === 0 && <p className="text-neutral-500 text-sm col-span-full">{t('Zatím nic v seznamu.', 'Nothing in the list yet.')}</p>}
      </div>
    </div>
  )
}

// Zaškrtávací seznam z katalogu vybavení pro konkrétní posilovnu — každá posilovna má svůj
// vlastní výběr, ne sdílený se všemi ostatními.
function GymEquipmentEditor({ gym, allEquipment }) {
  const { t } = useLanguage()
  const [selected, setSelected] = useState([])

  function load() {
    apiClient.get(`/gyms/${gym.id}/equipment`).then((r) => setSelected(r.data))
  }

  useEffect(load, [gym.id])

  async function toggle(item, checked) {
    if (checked) {
      await apiClient.post(`/gyms/${gym.id}/equipment`, { equipment_id: item.id })
    } else {
      await apiClient.delete(`/gyms/${gym.id}/equipment/${item.id}`)
    }
    load()
  }

  const selectedIds = new Set(selected.map((s) => s.id))

  return (
    <div className="border-t border-neutral-800 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
        {t('Vybavení téhle posilovny', "This gym's equipment")}
      </div>
      <div className="space-y-2">
        {allEquipment.filter((o) => o.active).map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selectedIds.has(item.id)} onChange={(e) => toggle(item, e.target.checked)} />
            {t(item.name, item.name_en || item.name)}
          </label>
        ))}
        {allEquipment.filter((o) => o.active).length === 0 && (
          <p className="text-neutral-500 text-sm">{t('Nejdřív přidej nějaké vybavení do katalogu níže.', 'Add some equipment to the catalog below first.')}</p>
        )}
      </div>
    </div>
  )
}
