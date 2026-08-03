const DOW_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
const DOW_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function dayOfWeek(dateStr, lang) {
  const d = new Date(dateStr + 'T00:00:00')
  return (lang === 'en' ? DOW_EN : DOW_CS)[(d.getDay() + 6) % 7]
}

export function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d}.${m}.${y}`
}

// Rozdíl ve dnech mezi teď a zadaným datem/časem (kladné = v minulosti). SQLite
// CURRENT_TIMESTAMP sloupce ("YYYY-MM-DD HH:MM:SS") jsou v UTC bez značky pásma — stejná
// konvence jako dřívější lokální timeAgo() v TrainerDashboard.jsx. Čisté datum
// ("YYYY-MM-DD", např. next_consultation_date) se bere jako lokální půlnoc.
export function daysSince(value) {
  if (!value) return null
  const iso = value.length > 10 ? value.replace(' ', 'T') + 'Z' : value + 'T00:00:00'
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

// Rozdíl ve dnech do zadaného data (kladné = v budoucnu, záporné = už uplynulo).
export function daysUntil(value) {
  const since = daysSince(value)
  return since === null ? null : -since
}
