// Formátuje jednu sérii/úsek pro read-only zobrazení v historii/přehledu deníku — strength
// (opakování×váha) vs. cardio (minuty/km), podle diary_sets.exercise_type z backendu.
export function formatDiarySet(s, type) {
  if (type === 'cardio') {
    const parts = []
    if (s.duration_min != null) parts.push(`${s.duration_min} min`)
    if (s.distance_km != null) parts.push(`${s.distance_km} km`)
    return parts.join(', ') || '?'
  }
  if (s.own_weight) {
    return `${s.reps ?? '?'}× vlastní váha${s.weight_kg != null ? ` +${s.weight_kg}kg` : ''}`
  }
  return `${s.reps ?? '?'}×${s.weight_kg ?? '?'}kg`
}

// Návrh dalšího tréninku vrací reps jako text ("6-8" nebo "5"), ne číslo — pro předvyplnění
// ručního zápisu (viz DiaryNextWorkout.jsx) vezme první číslo z rozsahu jako rozumný výchozí
// bod, jde ho v editoru upravit stejně jako cokoli jiného.
export function firstRepsNumber(reps) {
  const match = String(reps ?? '').match(/\d+/)
  return match ? Number(match[0]) : null
}

// Převede navržený cvik z /diary/next-workout na tvar, který čeká DiaryEntryEditor (pole sets
// podle počtu navržených sérií, každá s předvyplněnými opakováními/váhou) — klik na návrh tak
// rovnou otevře ruční zápis s hodnotami k doladění místo psaní od nuly.
export function suggestionToExercise(ex) {
  const reps = firstRepsNumber(ex.reps)
  const setCount = Math.max(1, Number(ex.sets) || 1)
  return {
    name: ex.name, type: 'strength',
    sets: Array.from({ length: setCount }, (_, i) => ({
      set_number: i + 1, reps, weight_kg: ex.target_weight_kg ?? null,
      own_weight: false, duration_min: null, distance_km: null,
    })),
  }
}
