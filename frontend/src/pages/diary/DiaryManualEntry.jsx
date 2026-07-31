import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { PenLine, Calendar, Clock, Check, NotebookPen } from 'lucide-react'
import { apiClient } from '../../api/client'
import DiaryEntryEditor from '../../components/DiaryEntryEditor'
import TimeSelect from '../../components/TimeSelect'
import DiaryBackLink from '../../components/DiaryBackLink'

export default function DiaryManualEntry() {
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [exercises, setExercises] = useState([{ name: '', type: 'strength', sets: [{ set_number: 1, reps: null, weight_kg: null, duration_min: null, distance_km: null }] }])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSave() {
    setError('')
    setLoading(true)
    try {
      await apiClient.post('/diary/entries', {
        recorded_at: recordedAt, start_time: startTime || null, end_time: endTime || null,
        exercises: exercises.filter((ex) => ex.name.trim() !== ''), notes: notes || null,
      })
      navigate('/diary')
    } catch {
      setError('Uložení se nepovedlo, zkus to prosím znovu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <DiaryBackLink />
      <h1 className="text-3xl mb-8 flex items-center gap-3">
        <PenLine className="text-blood-600" /> Zapsat trénink ručně
      </h1>

      {error && <div className="text-blood-400 text-sm mb-4">{error}</div>}

      <div className="space-y-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
          <label className="flex items-center gap-2 mb-2">
            <Calendar size={14} />
            <span>Datum tréninku:</span>
            <input
              type="date" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)}
              className="px-2 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-200"
            />
          </label>
          <div className="flex items-center gap-2 gap-y-1.5 flex-wrap">
            <Clock size={14} />
            <span>Čas:</span>
            <TimeSelect
              value={startTime} onChange={setStartTime}
              className="w-14 px-1 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm"
            />
            <span className="text-neutral-600">–</span>
            <TimeSelect
              value={endTime} onChange={setEndTime}
              className="w-14 px-1 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm"
            />
          </div>
        </div>

        <DiaryEntryEditor exercises={exercises} onChange={setExercises} />

        <label className="block text-sm text-neutral-400">
          <span className="flex items-center gap-2 mb-1"><NotebookPen size={14} /> Poznámka</span>
          <textarea
            rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Únava před/po, jak se cvičilo, spánek, strava — cokoli, co mohlo ovlivnit trénink"
            className="w-full px-3 py-2 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-200 resize-y"
          />
        </label>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} disabled={loading} className="px-4 py-2.5 rounded-md bg-blood-700 hover:bg-blood-600 disabled:opacity-50 font-medium flex items-center gap-2">
            <Check size={16} /> {loading ? 'Ukládám…' : 'Uložit trénink'}
          </button>
          <Link to="/diary" className="text-sm text-neutral-400 hover:text-neutral-200 ml-auto">Zrušit</Link>
        </div>
      </div>
    </div>
  )
}
