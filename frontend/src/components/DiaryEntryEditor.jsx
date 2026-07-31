import { Plus, Trash2 } from 'lucide-react'

// Editovatelný seznam cviků/sérií pro jeden deníkový záznam — sdíleno mezi DiaryRecord
// (potvrzení čerstvě rozpoznaného tréninku) a DiaryHistory (dodatečná úprava).
export default function DiaryEntryEditor({ exercises, onChange }) {
  function updateExerciseName(exIdx, name) {
    onChange(exercises.map((ex, i) => (i === exIdx ? { ...ex, name } : ex)))
  }
  function updateSet(exIdx, setIdx, field, value) {
    onChange(exercises.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: value === '' ? null : Number(value) } : s)),
    }))
  }
  function removeSet(exIdx, setIdx) {
    onChange(exercises.map((ex, i) => i !== exIdx ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) }))
  }
  function addSet(exIdx) {
    onChange(exercises.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: [...ex.sets, { set_number: ex.sets.length + 1, reps: null, weight_kg: null }],
    }))
  }
  function removeExercise(exIdx) {
    onChange(exercises.filter((_, i) => i !== exIdx))
  }
  function addExercise() {
    onChange([...exercises, { name: '', sets: [{ set_number: 1, reps: null, weight_kg: null }] }])
  }

  return (
    <div className="space-y-4">
      {exercises.map((ex, exIdx) => (
        <div key={exIdx} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <input
              value={ex.name} onChange={(ev) => updateExerciseName(exIdx, ev.target.value)}
              className="flex-1 px-2 py-1.5 rounded-md bg-neutral-950 border border-neutral-800 font-medium"
            />
            <button onClick={() => removeExercise(exIdx)} className="text-neutral-500 hover:text-blood-400 p-1">
              <Trash2 size={16} />
            </button>
          </div>
          <div className="space-y-1.5">
            {ex.sets.map((s, setIdx) => (
              <div key={setIdx} className="flex items-center gap-2 text-sm">
                <span className="text-neutral-500 w-6">#{setIdx + 1}</span>
                <input
                  type="number" value={s.reps ?? ''} onChange={(ev) => updateSet(exIdx, setIdx, 'reps', ev.target.value)}
                  placeholder="opak." className="w-20 px-2 py-1 rounded-md bg-neutral-950 border border-neutral-800"
                />
                <span className="text-neutral-600">×</span>
                <input
                  type="number" step="0.5" value={s.weight_kg ?? ''} onChange={(ev) => updateSet(exIdx, setIdx, 'weight_kg', ev.target.value)}
                  placeholder="kg" className="w-20 px-2 py-1 rounded-md bg-neutral-950 border border-neutral-800"
                />
                <span className="text-neutral-600">kg</span>
                <button onClick={() => removeSet(exIdx, setIdx)} className="text-neutral-600 hover:text-blood-400 ml-auto p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button onClick={() => addSet(exIdx)} className="text-xs text-blood-500 hover:text-blood-400 flex items-center gap-1 mt-1">
              <Plus size={12} /> Přidat sérii
            </button>
          </div>
        </div>
      ))}
      <button onClick={addExercise} className="text-sm text-blood-500 hover:text-blood-400 flex items-center gap-1">
        <Plus size={14} /> Přidat cvik
      </button>
    </div>
  )
}
