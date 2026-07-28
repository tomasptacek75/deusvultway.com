import { useEffect, useState } from 'react'
import { Dumbbell, Plus, Pencil, Eye, EyeOff } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'

const emptyForm = { name: '', name_en: '', kind: 'equipment' }

// Spravovaný seznam posiloven/vybavení pro portálové klienty (výběr ze seznamu, ne volný
// text — viz ClientDetail.jsx EquipmentTab). Skrýt, nikdy smazat: PUT s active=0/1 místo DELETE.
export default function Equipment() {
  const { t } = useLanguage()
  const [options, setOptions] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)

  function load() {
    apiClient.get('/equipment-options', { params: { include_inactive: 1 } }).then((r) => setOptions(r.data))
  }

  useEffect(load, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await apiClient.post('/equipment-options', form)
    setForm(emptyForm)
    setShowForm(false)
    load()
  }

  async function toggleActive(o) {
    await apiClient.put(`/equipment-options/${o.id}`, { active: o.active ? 0 : 1 })
    load()
  }

  function startEdit(o) {
    setEditingId(o.id)
    setEditForm({ name: o.name, name_en: o.name_en ?? '', kind: o.kind })
  }

  async function saveEdit(e) {
    e.preventDefault()
    await apiClient.put(`/equipment-options/${editingId}`, editForm)
    setEditingId(null)
    load()
  }

  const gyms = options.filter((o) => o.kind === 'gym')
  const equipment = options.filter((o) => o.kind === 'equipment')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl flex items-center gap-3">
          <Dumbbell className="text-blood-600" /> {t('Vybavení', 'Equipment')}
        </h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 bg-blood-700 hover:bg-blood-600 transition-colors px-4 py-2 rounded-md font-medium"
        >
          <Plus size={18} /> {t('Nová položka', 'New item')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900 p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            required
            placeholder={t('Název', 'Name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
          />
          <input
            placeholder={t('Anglický název (volitelné)', 'English name (optional)')}
            value={form.name_en}
            onChange={(e) => setForm({ ...form, name_en: e.target.value })}
            className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
          />
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
          >
            <option value="gym">{t('Posilovna', 'Gym')}</option>
            <option value="equipment">{t('Vybavení', 'Equipment')}</option>
          </select>
          <button type="submit" className="bg-blood-700 hover:bg-blood-600 transition-colors px-4 py-2 rounded-md font-medium md:col-span-3">
            {t('Uložit', 'Save')}
          </button>
        </form>
      )}

      {[
        [t('Posilovny', 'Gyms'), gyms],
        [t('Vybavení', 'Equipment'), equipment],
      ].map(([label, list]) => (
        <div key={label} className="mb-8">
          <h2 className="text-lg mb-3 text-neutral-300">{label}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((o) => (
              <div key={o.id} className={`rounded-lg border border-neutral-800 bg-neutral-900 p-4 ${o.active ? '' : 'opacity-50'}`}>
                {editingId === o.id ? (
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
                    <span className="font-medium">{t(o.name, o.name_en || o.name)}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEdit(o)} className="text-neutral-600 hover:text-blood-500">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => toggleActive(o)} className="text-neutral-600 hover:text-blood-500" title={o.active ? t('Skrýt', 'Hide') : t('Odkrýt', 'Show')}>
                        {o.active ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {list.length === 0 && <p className="text-neutral-500 text-sm col-span-full">{t('Zatím nic v seznamu.', 'Nothing in the list yet.')}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
