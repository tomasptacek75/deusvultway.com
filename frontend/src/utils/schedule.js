import { apiClient } from '../api/client'

// Tréninky nemají uloženou délku trvání — počítáme s pevnou hodinovou lekcí (stejný
// předpoklad jako "probíhá"/"další" zvýraznění v TrainerCalendar.jsx).
export const SESSION_LENGTH_MIN = 60

export function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// Najde jiný trénink (libovolného klienta) ve stejný den, jehož hodinová lekce se časově
// překrývá s nově zadávaným časem. Přesně shodný start se nepočítá jako kolize — to je
// záměrná skupinová lekce (viz CalendarView.jsx groupByTime). Vrací kolidující trénink,
// nebo null když nic nekoliduje.
export async function findScheduleConflict({ date, time, excludeWorkoutId }) {
  if (!date || !time) return null
  const { data } = await apiClient.get('/schedule', { params: { from: date, to: date } })
  const newEnd = addMinutes(time, SESSION_LENGTH_MIN)
  for (const w of data) {
    if (w.id === excludeWorkoutId || !w.time || w.time === time) continue
    const existEnd = addMinutes(w.time, SESSION_LENGTH_MIN)
    if (time < existEnd && w.time < newEnd) return w
  }
  return null
}
