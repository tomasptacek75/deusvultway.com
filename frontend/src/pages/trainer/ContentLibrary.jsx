import { useEffect, useState } from 'react'
import { BookOpen, Plus, ChevronDown, ChevronUp, Pencil, Eye, EyeOff } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'

const emptyItemForm = { type: 'video', title: '', title_en: '', body: '', body_en: '', url: '' }
const emptySectionForm = { title: '', kind: 'library' }

// Obsahová knihovna (video ukázky, strava, playlisty, cokoli dalšího) — viditelná všem
// klientům (osobní i portál), ne jen portálovým. Skrýt, nikdy smazat: PUT s active=0/1.
export default function ContentLibrary() {
  const { t } = useLanguage()
  const [sections, setSections] = useState([])
  const [newSection, setNewSection] = useState(emptySectionForm)
  const [showNewSection, setShowNewSection] = useState(false)
  const [expanded, setExpanded] = useState(null)

  function load() {
    apiClient.get('/content-sections', { params: { include_inactive: 1 } }).then((r) => setSections(r.data))
  }

  useEffect(load, [])

  async function createSection(e) {
    e.preventDefault()
    await apiClient.post('/content-sections', newSection)
    setNewSection(emptySectionForm)
    setShowNewSection(false)
    load()
  }

  async function toggleSectionActive(section) {
    await apiClient.put(`/content-sections/${section.id}`, { active: section.active ? 0 : 1 })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl flex items-center gap-3">
          <BookOpen className="text-blood-600" /> {t('Knihovna', 'Library')}
        </h1>
        <button
          onClick={() => setShowNewSection((s) => !s)}
          className="flex items-center gap-2 bg-blood-700 hover:bg-blood-600 transition-colors px-4 py-2 rounded-md font-medium"
        >
          <Plus size={18} /> {t('Nová sekce', 'New section')}
        </button>
      </div>

      {showNewSection && (
        <form onSubmit={createSection} className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-5 flex flex-wrap gap-3">
          <input
            required
            placeholder={t('Název sekce (např. Strava)', 'Section title (e.g. Nutrition)')}
            value={newSection.title}
            onChange={(e) => setNewSection({ ...newSection, title: e.target.value })}
            className="flex-1 min-w-[12rem] bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
          />
          <select
            value={newSection.kind}
            onChange={(e) => setNewSection({ ...newSection, kind: e.target.value })}
            className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
          >
            <option value="library">{t('Knihovna', 'Library')}</option>
            <option value="about_me">{t('O mně (Davidova zóna)', 'About me (David’s zone)')}</option>
          </select>
          <button type="submit" className="bg-blood-700 hover:bg-blood-600 transition-colors px-4 py-2 rounded-md font-medium">
            {t('Uložit', 'Save')}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {sections.map((s) => (
          <div key={s.id} className={`rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden ${s.active ? '' : 'opacity-50'}`}>
            <div className="flex items-center justify-between p-4">
              <button
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                {expanded === s.id ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
                <span className="font-semibold truncate">{t(s.title, s.title_en || s.title)}</span>
                <span className="text-xs text-neutral-500 shrink-0">({s.items.length})</span>
                {s.kind === 'about_me' && (
                  <span className="text-[10px] uppercase tracking-wide text-blood-500 border border-blood-900/50 rounded px-1.5 py-0.5 shrink-0">
                    {t('O mně', 'About me')}
                  </span>
                )}
              </button>
              <button onClick={() => toggleSectionActive(s)} className="text-neutral-600 hover:text-blood-500 shrink-0" title={s.active ? t('Skrýt sekci', 'Hide section') : t('Odkrýt sekci', 'Show section')}>
                {s.active ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            {expanded === s.id && <SectionEditor section={s} onChange={load} />}
          </div>
        ))}
        {sections.length === 0 && <p className="text-neutral-500">{t('Zatím žádné sekce.', 'No sections yet.')}</p>}
      </div>
    </div>
  )
}

function SectionEditor({ section, onChange }) {
  const { t } = useLanguage()
  const [form, setForm] = useState(emptyItemForm)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyItemForm)

  async function addItem(e) {
    e.preventDefault()
    await apiClient.post(`/content-sections/${section.id}/items`, form)
    setForm(emptyItemForm)
    onChange()
  }

  function startEdit(item) {
    setEditingId(item.id)
    setEditForm({
      type: item.type, title: item.title, title_en: item.title_en ?? '',
      body: item.body ?? '', body_en: item.body_en ?? '', url: item.url ?? '',
    })
  }

  async function saveEdit(e) {
    e.preventDefault()
    await apiClient.put(`/content-items/${editingId}`, editForm)
    setEditingId(null)
    onChange()
  }

  async function toggleItemActive(item) {
    await apiClient.put(`/content-items/${item.id}`, { active: item.active ? 0 : 1 })
    onChange()
  }

  return (
    <div className="border-t border-neutral-800 p-4 space-y-3">
      {section.items.map((item) => (
        <div key={item.id} className={`rounded-md bg-neutral-950 border border-neutral-800 p-3 ${item.active ? '' : 'opacity-50'}`}>
          {editingId === item.id ? (
            <form onSubmit={saveEdit} className="space-y-2">
              <select
                value={editForm.type}
                onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-sm"
              >
                <option value="video">{t('Video', 'Video')}</option>
                <option value="article">{t('Text', 'Article')}</option>
                <option value="playlist">{t('Playlist', 'Playlist')}</option>
                <option value="qa">{t('Otázka a odpověď', 'Q&A')}</option>
              </select>
              <input
                required
                placeholder={t('Název', 'Title')}
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-sm"
              />
              <textarea
                placeholder={t('Popis (volitelné)', 'Description (optional)')}
                value={editForm.body}
                onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-sm"
                rows={2}
              />
              <input
                placeholder={t('URL (video/playlist odkaz, volitelné)', 'URL (video/playlist link, optional)')}
                value={editForm.url}
                onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-sm"
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
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-blood-500 uppercase tracking-wide">{item.type}</div>
                <div className="font-medium">{t(item.title, item.title_en || item.title)}</div>
                {item.body && <div className="text-sm text-neutral-400 mt-0.5">{t(item.body, item.body_en || item.body)}</div>}
                {item.url && <div className="text-xs text-neutral-500 truncate mt-0.5">{item.url}</div>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => startEdit(item)} className="text-neutral-600 hover:text-blood-500">
                  <Pencil size={14} />
                </button>
                <button onClick={() => toggleItemActive(item)} className="text-neutral-600 hover:text-blood-500" title={item.active ? t('Skrýt', 'Hide') : t('Odkrýt', 'Show')}>
                  {item.active ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <form onSubmit={addItem} className="flex flex-wrap gap-2 items-center pt-2">
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
        >
          <option value="video">{t('Video', 'Video')}</option>
          <option value="article">{t('Text', 'Article')}</option>
          <option value="playlist">{t('Playlist', 'Playlist')}</option>
          <option value="qa">{t('Otázka a odpověď', 'Q&A')}</option>
        </select>
        <input
          required
          placeholder={t('Název', 'Title')}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
        />
        <input
          placeholder={t('URL (volitelné)', 'URL (optional)')}
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
        />
        <button type="submit" className="bg-neutral-800 hover:bg-blood-700 transition-colors rounded-md px-3 py-2 text-sm font-medium">
          {t('Přidat položku', 'Add item')}
        </button>
      </form>
    </div>
  )
}
