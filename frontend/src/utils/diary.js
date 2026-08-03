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

const BLOCK_WINDOW_MS = 120 * 60 * 1000

// Nejlepší dostupný časový údaj pro řazení/seskupování záznamu — start_time (čas tréninku,
// zadaný uživatelem) má přednost, jinak created_at (kdy byl záznam skutečně uložen; SQLite
// CURRENT_TIMESTAMP je v UTC bez značky pásma), jinak jen půlnoc daného dne jako poslední
// záchrana (starší záznamy bez ani jednoho z předchozích).
function entryTimestamp(e) {
  if (e.recorded_at && e.start_time) return new Date(`${e.recorded_at}T${e.start_time}:00`).getTime()
  if (e.created_at) return new Date(e.created_at.replace(' ', 'T') + 'Z').getTime()
  if (e.recorded_at) return new Date(`${e.recorded_at}T00:00:00`).getTime()
  return 0
}

// Seskupí záznamy stejného dne, které jsou od sebe namluvené/zapsané do 120 minut, do
// jednoho "bloku" (víc krátkých namluvení jednoho tréninku — rozcvička/hlavní část/kardio
// zvlášť). Čistě zobrazovací seskupení, žádná data se neslučují ani nemažou — každý záznam
// v bloku zůstává samostatně editovatelný/smazatelný. Vstup i výstupní bloky zachovávají
// pořadí od nejnovějšího (stejně jako GET /diary/entries).
export function groupDiaryEntriesIntoBlocks(entries) {
  if (!entries?.length) return []
  // Řadit vzestupně pro plynulé okénkování, pak bloky na konci otočit zpátky na sestupně.
  const sorted = entries.slice().sort((a, b) => entryTimestamp(a) - entryTimestamp(b))
  const blocks = []
  for (const e of sorted) {
    const last = blocks[blocks.length - 1]
    const prev = last?.entries[last.entries.length - 1]
    const sameDay = prev && prev.recorded_at === e.recorded_at
    const withinWindow = prev && Math.abs(entryTimestamp(e) - entryTimestamp(prev)) <= BLOCK_WINDOW_MS
    if (last && sameDay && withinWindow) {
      last.entries.push(e)
    } else {
      blocks.push({ entries: [e] })
    }
  }
  blocks.reverse()
  for (const b of blocks) b.entries.reverse()
  return blocks
}
