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
