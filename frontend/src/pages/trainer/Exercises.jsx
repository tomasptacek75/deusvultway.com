import { useEffect, useState } from 'react'
import { Dumbbell, Plus, Trash2, Pencil, Video } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'

const emptyForm = { name: '', muscle_group: '', category: '', cues: '', video_url: '' }

export default function Exercises() {
  const { t } = useLanguage()
  const [exercises, setExercises] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)

  function load() {
    apiClient.get('/exercises').then((r) => setExercises(r.data))
  }

  useEffect(load, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await apiClient.post('/exercises', form)
    setForm(emptyForm)
    setShowForm(false)
    load()
  }

  async function handleDelete(id) {
    await apiClient.delete(`/exercises/${id}`)
    load()
  }

  function startEdit(ex) {
    setEditingId(ex.id)
    setEditForm({
      name: ex.name,
      muscle_group: ex.muscle_group ?? '',
      category: ex.category ?? '',
      cues: ex.cues ?? '',
      video_url: ex.video_url ?? '',
    })
  }

  async function saveEdit(e) {
    e.preventDefault()
    await apiClient.put(`/exercises/${editingId}`, editForm)
    setEditingId(null)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl flex items-center gap-3">
          <Dumbbell className="text-blood-600" /> {t('Knihovna cviků', 'Exercise library')}
        </h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 bg-blood-700 hover:bg-blood-600 transition-colors px-4 py-2 rounded-md font-medium"
        >
          <Plus size={18} /> {t('Nový cvik', 'New exercise')}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900 p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <input
            required
            placeholder={t('Název cviku', 'Exercise name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
          />
          <input
            placeholder={t('Svalová partie (např. Nohy)', 'Muscle group (e.g. Legs)')}
            value={form.muscle_group}
            onChange={(e) => setForm({ ...form, muscle_group: e.target.value })}
            className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
          />
          <input
            placeholder={t('Kategorie / pohybový vzor (např. Dřep, Tah, Tlak)', 'Category / movement pattern (e.g. Squat, Pull, Push)')}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 md:col-span-2"
          />
          <textarea
            placeholder={t('Na co si dát pozor / komentář k technice', 'What to watch out for / technique notes')}
            value={form.cues}
            onChange={(e) => setForm({ ...form, cues: e.target.value })}
            className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 md:col-span-2"
            rows={2}
          />
          <input
            placeholder={t('URL videa (volitelné, např. YouTube unlisted odkaz)', 'Video URL (optional, e.g. YouTube unlisted link)')}
            value={form.video_url}
            onChange={(e) => setForm({ ...form, video_url: e.target.value })}
            className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 md:col-span-2"
          />
          <button
            type="submit"
            className="bg-blood-700 hover:bg-blood-600 transition-colors px-4 py-2 rounded-md font-medium md:col-span-2"
          >
            {t('Uložit cvik', 'Save exercise')}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {exercises.map((ex) => (
          <div key={ex.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            {editingId === ex.id ? (
              <form onSubmit={saveEdit} className="space-y-2">
                <input
                  required
                  placeholder={t('Název cviku', 'Exercise name')}
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
                />
                <input
                  placeholder={t('Svalová partie (např. Nohy)', 'Muscle group (e.g. Legs)')}
                  value={editForm.muscle_group}
                  onChange={(e) => setEditForm({ ...editForm, muscle_group: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
                />
                <input
                  placeholder={t('Kategorie / pohybový vzor', 'Category / movement pattern')}
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
                />
                <textarea
                  placeholder={t('Na co si dát pozor / komentář k technice', 'What to watch out for / technique notes')}
                  value={editForm.cues}
                  onChange={(e) => setEditForm({ ...editForm, cues: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
                  rows={2}
                />
                <input
                  placeholder={t('URL videa (volitelné)', 'Video URL (optional)')}
                  value={editForm.video_url}
                  onChange={(e) => setEditForm({ ...editForm, video_url: e.target.value })}
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
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{t(ex.name, ex.name_en || ex.name)}</div>
                    {(ex.muscle_group || ex.category) && (
                      <div className="text-xs text-blood-500 uppercase tracking-wide mt-0.5">
                        {[t(ex.muscle_group, ex.muscle_group_en || ex.muscle_group), ex.category].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(ex)} className="text-neutral-600 hover:text-blood-500">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(ex.id)} className="text-neutral-600 hover:text-blood-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {ex.cues && <p className="text-sm text-neutral-400 mt-3">{t(ex.cues, ex.cues_en || ex.cues)}</p>}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
                  <Video size={14} />
                  {ex.video_url ? t('Video přiloženo', 'Video attached') : t('Video bude brzy k dispozici', 'Video coming soon')}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
