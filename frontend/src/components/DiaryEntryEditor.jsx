import { Plus, Trash2 } from 'lucide-react'

// Editovatelný seznam cviků/aktivit pro jeden deníkový záznam — sdíleno mezi DiaryRecord
// (potvrzení čerstvě rozpoznaného tréninku), DiaryHistory (dodatečná úprava) a DiaryManualEntry
// (ruční zápis). Každá položka je 'strength' (série/opakování/váha) nebo 'cardio' (běh, kolo...
// — délka v minutách a/nebo vzdálenost v km).
export default function DiaryEntryEditor({ exercises, onChange }) {
  function updateExerciseName(exIdx, name) {
    onChange(exercises.map((ex, i) => (i === exIdx ? { ...ex, name } : ex)))
  }
  function updateExerciseType(exIdx, type) {
    onChange(exercises.map((ex, i) => (i === exIdx ? { ...ex, type } : ex)))
  }
  function updateSet(exIdx, setIdx, field, value) {
    onChange(exercises.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: value === '' ? null : Number(value) } : s)),
    }))
  }
  function toggleOwnWeight(exIdx, setIdx) {
    onChange(exercises.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, own_weight: !s.own_weight, weight_kg: s.own_weight ? s.weight_kg : null } : s)),
    }))
  }
  function removeSet(exIdx, setIdx) {
    onChange(exercises.map((ex, i) => i !== exIdx ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) }))
  }
  // Nová série se předvyplní podle té předchozí (stejný cvik) — obvykle se opakování/váha
  // mezi sériemi mění málo nebo vůbec, jde jen upravit, ne muset zadávat znovu od nuly.
  function addSet(exIdx) {
    onChange(exercises.map((ex, i) => {
      if (i !== exIdx) return ex
      const prev = ex.sets[ex.sets.length - 1]
      return {
        ...ex, sets: [...ex.sets, {
          set_number: ex.sets.length + 1,
          reps: prev?.reps ?? null, weight_kg: prev?.weight_kg ?? null, own_weight: prev?.own_weight ?? false,
          duration_min: prev?.duration_min ?? null, distance_km: prev?.distance_km ?? null,
        }],
      }
    }))
  }
  function removeExercise(exIdx) {
    onChange(exercises.filter((_, i) => i !== exIdx))
  }
  function addExercise(type) {
    onChange([...exercises, { name: '', type, sets: [{ set_number: 1, reps: null, weight_kg: null, own_weight: false, duration_min: null, distance_km: null }] }])
  }

  return (
    <div className="space-y-4">
      {exercises.map((ex, exIdx) => {
        const isCardio = ex.type === 'cardio'
        return (
          <div key={exIdx} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center gap-3 mb-3">
              <input
                value={ex.name} onChange={(ev) => updateExerciseName(exIdx, ev.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-neutral-950 border border-neutral-800 font-medium"
              />
              <button onClick={() => removeExercise(exIdx)} className="shrink-0 text-neutral-500 hover:text-blood-400 hover:bg-neutral-800 rounded-md p-1.5">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => updateExerciseType(exIdx, 'strength')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  !isCardio ? 'bg-blood-700 border-blood-700 text-white' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                Silový
              </button>
              <button
                onClick={() => updateExerciseType(exIdx, 'cardio')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  isCardio ? 'bg-blood-700 border-blood-700 text-white' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                Kardio
              </button>
            </div>
            <div className="space-y-1.5">
              {ex.sets.map((s, setIdx) => (
                <div key={setIdx} className="flex items-center gap-2 gap-y-1.5 text-sm flex-wrap">
                  <span className="text-neutral-500 w-6">#{setIdx + 1}</span>
                  {isCardio ? (
                    <>
                      <input
                        type="number" step="0.5" value={s.duration_min ?? ''} onChange={(ev) => updateSet(exIdx, setIdx, 'duration_min', ev.target.value)}
                        placeholder="0" className="w-14 px-2 py-1 rounded-md bg-neutral-950 border border-neutral-800"
                      />
                      <span className="text-neutral-600">min</span>
                      <input
                        type="number" step="0.1" value={s.distance_km ?? ''} onChange={(ev) => updateSet(exIdx, setIdx, 'distance_km', ev.target.value)}
                        placeholder="0" className="w-16 px-2 py-1 rounded-md bg-neutral-950 border border-neutral-800"
                      />
                      <span className="text-neutral-600">km</span>
                    </>
                  ) : (
                    <>
                      <input
                        type="number" value={s.reps ?? ''} onChange={(ev) => updateSet(exIdx, setIdx, 'reps', ev.target.value)}
                        placeholder="opak." className="w-14 px-2 py-1 rounded-md bg-neutral-950 border border-neutral-800"
                      />
                      <span className="text-neutral-600">×</span>
                      {!s.own_weight && (
                        <>
                          <input
                            type="number" step="0.5" value={s.weight_kg ?? ''} onChange={(ev) => updateSet(exIdx, setIdx, 'weight_kg', ev.target.value)}
                            placeholder="kg" className="w-16 px-2 py-1 rounded-md bg-neutral-950 border border-neutral-800"
                          />
                          <span className="text-neutral-600">kg</span>
                        </>
                      )}
                      <label className="flex items-center gap-1 text-xs text-neutral-500 whitespace-nowrap cursor-pointer">
                        <input type="checkbox" checked={!!s.own_weight} onChange={() => toggleOwnWeight(exIdx, setIdx)} />
                        vlastní váha
                      </label>
                    </>
                  )}
                  <button onClick={() => removeSet(exIdx, setIdx)} className="text-neutral-600 hover:text-blood-400 ml-auto p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button onClick={() => addSet(exIdx)} className="text-xs text-blood-500 hover:text-blood-400 flex items-center gap-1 mt-1">
                <Plus size={12} /> {isCardio ? 'Přidat úsek' : 'Přidat sérii'}
              </button>
            </div>
          </div>
        )
      })}
      <div className="flex gap-3">
        <button onClick={() => addExercise('strength')} className="text-sm text-blood-500 hover:text-blood-400 flex items-center gap-1">
          <Plus size={14} /> Přidat cvik
        </button>
        <button onClick={() => addExercise('cardio')} className="text-sm text-blood-500 hover:text-blood-400 flex items-center gap-1">
          <Plus size={14} /> Přidat kardio
        </button>
      </div>
    </div>
  )
}
