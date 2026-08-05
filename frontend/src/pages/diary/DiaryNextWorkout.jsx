import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Clock, RefreshCw } from 'lucide-react'
import { apiClient } from '../../api/client'
import DiaryBackLink from '../../components/DiaryBackLink'
import { suggestionToExercise } from '../../utils/diary'

export default function DiaryNextWorkout() {
  const [suggestion, setSuggestion] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const navigate = useNavigate()

  // Klik na navržený cvik rovnou otevře ruční zápis s předvyplněnými sériemi/opakováními/vahou
  // podle návrhu — jen k doladění, ne psaní od nuly.
  function prefillFromSuggestion(ex) {
    navigate('/diary/manual', { state: { prefillExercise: suggestionToExercise(ex) } })
  }

  function load(noteOverride) {
    setLoading(true)
    setError('')
    apiClient.get('/diary/next-workout', { params: { note: noteOverride || undefined } })
      .then((r) => setSuggestion(r.data))
      .catch((err) => setError(err.response?.data?.detail || 'Návrh se nepodařilo načíst.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <div>
      <DiaryBackLink />
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl flex items-center gap-3">
          <Sparkles className="text-blood-600" /> Návrh dalšího tréninku
        </h1>
        <button onClick={() => load()} disabled={loading} className="text-neutral-400 hover:text-neutral-200 p-2 disabled:opacity-50" title="Přepočítat">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 mb-4">
        <label className="block text-sm text-neutral-400 mb-2">
          Poznámka k dnešnímu stavu (nepovinné) — např. "chci jít dnes", "bolí mě nohy", zranění...
        </label>
        <textarea
          rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Cokoli, co by mělo ovlivnit dnešní návrh"
          className="w-full px-3 py-2 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-200 resize-y text-sm"
        />
        <button
          onClick={() => load(note)} disabled={loading}
          className="mt-2 px-3 py-1.5 rounded-md bg-blood-700 hover:bg-blood-600 disabled:opacity-50 text-sm font-medium"
        >
          Přegenerovat s poznámkou
        </button>
      </div>

      {loading && <p className="text-neutral-500 text-sm">Přemýšlím nad tvým dalším tréninkem…</p>}
      {error && !loading && <div className="text-blood-400 text-sm">{error}</div>}

      {suggestion && !loading && (
        <div className="space-y-4">
          <div className="rounded-lg border border-blood-700 bg-blood-900/20 p-5">
            <p className="text-neutral-200">{suggestion.summary}</p>
            {suggestion.suggested_timing && (
              <div className="text-sm text-neutral-400 mt-2 flex items-center gap-1.5">
                <Clock size={14} /> {suggestion.suggested_timing}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {suggestion.suggested_exercises?.map((ex, i) => (
              <button
                key={i} onClick={() => prefillFromSuggestion(ex)}
                className="w-full text-left rounded-lg border border-neutral-800 bg-neutral-900 p-4 hover:border-blood-700 transition-colors"
                title="Zapsat tento cvik ručně (předvyplní se podle návrhu)"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{ex.name}</span>
                  <span className="text-sm text-neutral-400">
                    {ex.sets}×{ex.reps}{ex.target_weight_kg ? ` @ ${ex.target_weight_kg} kg` : ''}
                  </span>
                </div>
                {ex.reason && <p className="text-xs text-neutral-500 mt-1">{ex.reason}</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
