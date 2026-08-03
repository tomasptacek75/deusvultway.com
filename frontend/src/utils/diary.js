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
