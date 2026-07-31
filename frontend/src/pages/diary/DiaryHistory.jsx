import { useEffect, useState } from 'react'
import { History as HistoryIcon, ChevronDown, ChevronUp, Trash2, Check, Pencil, Calendar, Clock } from 'lucide-react'
import { apiClient } from '../../api/client'
import DiaryEntryEditor from '../../components/DiaryEntryEditor'
import TimeSelect from '../../components/TimeSelect'

export default function DiaryHistory() {
  const [entries, setEntries] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [editing, setEditing] = useState(null)

  function load() {
    apiClient.get('/diary/entries').then((r) => setEntries(r.data))
  }
  useEffect(load, [])

  async function saveEdits(entry) {
    const { data } = await apiClient.put(`/diary/entries/${entry.id}`, {
      recorded_at: entry.recorded_at, notes: entry.notes, exercises: entry.exercises,
      start_time: entry.start_time, end_time: entry.end_time,
    })
    setEntries((all) => all.map((e) => (e.id === data.id ? data : e)))
    setEditing(null)
  }

  async function removeEntry(id) {
    if (!window.confirm('Opravdu smazat tento záznam?')) return
    await apiClient.delete(`/diary/entries/${id}`)
    setEntries((all) => all.filter((e) => e.id !== id))
  }

  return (
    <div>
      <h1 className="text-3xl mb-8 flex items-center gap-3">
        <HistoryIcon className="text-blood-600" /> Historie tréninků
      </h1>

      <div className="space-y-2">
        {entries?.map((e) => (
          <div key={e.id} className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === e.id ? null : e.id)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div>
                <div className="text-xs text-neutral-500 flex items-center gap-2">
                  <span>{e.recorded_at}</span>
                  {e.start_time && (
                    <span className="flex items-center gap-0.5">
                      <Clock size={11} /> {e.start_time}{e.end_time ? `–${e.end_time}` : ''}
                    </span>
                  )}
                </div>
                <div className="font-medium mt-0.5">{e.exercises.map((ex) => ex.name).join(', ') || 'Bez cviků'}</div>
              </div>
              {expanded === e.id ? <ChevronUp size={18} className="text-neutral-500" /> : <ChevronDown size={18} className="text-neutral-500" />}
            </button>
            {expanded === e.id && (
              <div className="border-t border-neutral-800 p-4 space-y-3">
                {e.notes && <div className="text-sm text-neutral-400 italic">{e.notes}</div>}

                {editing === e.id ? (
                  <>
                    <label className="flex items-center gap-2 text-sm text-neutral-400">
                      <Calendar size={14} />
                      <span>Datum:</span>
                      <input
                        type="date" value={e.recorded_at || ''}
                        onChange={(ev) => setEntries((all) => all.map((x) => (x.id === e.id ? { ...x, recorded_at: ev.target.value } : x)))}
                        className="px-2 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-200"
                      />
                    </label>
                    <div className="flex items-center gap-2 text-sm text-neutral-400">
                      <Clock size={14} />
                      <span>Čas:</span>
                      <TimeSelect
                        value={e.start_time}
                        onChange={(v) => setEntries((all) => all.map((x) => (x.id === e.id ? { ...x, start_time: v } : x)))}
                        className="px-1.5 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-200"
                      />
                      <span className="text-neutral-600">–</span>
                      <TimeSelect
                        value={e.end_time}
                        onChange={(v) => setEntries((all) => all.map((x) => (x.id === e.id ? { ...x, end_time: v } : x)))}
                        className="px-1.5 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-200"
                      />
                    </div>
                    <DiaryEntryEditor
                      exercises={e.exercises}
                      onChange={(exercises) => setEntries((all) => all.map((x) => (x.id === e.id ? { ...x, exercises } : x)))}
                    />
                    <div className="flex items-center gap-3">
                      <button onClick={() => saveEdits(e)} className="px-3 py-2 rounded-md bg-blood-700 hover:bg-blood-600 text-sm font-medium flex items-center gap-1.5">
                        <Check size={14} /> Uložit
                      </button>
                      <button onClick={() => { setEditing(null); load() }} className="text-sm text-neutral-400 hover:text-neutral-200">Zrušit</button>
                    </div>
                  </>
                ) : (
                  <>
                    {e.exercises.map((ex, i) => (
                      <div key={i} className="text-sm">
                        <span className="font-medium">{ex.name}</span>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          {ex.sets.map((s) => `${s.reps ?? '?'}×${s.weight_kg ?? '?'}kg`).join(', ') || 'Bez sérií'}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-3 pt-1">
                      <button onClick={() => setEditing(e.id)} className="text-sm text-blood-500 hover:text-blood-400 flex items-center gap-1">
                        <Pencil size={14} /> Upravit
                      </button>
                      <button onClick={() => removeEntry(e.id)} className="text-sm text-neutral-500 hover:text-blood-400 flex items-center gap-1">
                        <Trash2 size={14} /> Smazat
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {entries?.length === 0 && <p className="text-neutral-500 text-sm">Zatím žádné záznamy.</p>}
        {entries === null && <p className="text-neutral-500 text-sm">Načítám…</p>}
      </div>
    </div>
  )
}
