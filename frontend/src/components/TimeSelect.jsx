import { useLanguage } from '../i18n/LanguageContext'

const HOURS = Array.from({ length: 21 - 7 + 1 }, (_, i) => String(i + 7).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

export default function TimeSelect({ value, onChange, className = '', autoFocus }) {
  const { t } = useLanguage()
  const [h, m] = (value || '').split(':')

  function setHour(newH) {
    if (!newH) { onChange(''); return }
    const defaultMinute = Number(newH) < 12 ? '00' : '45'
    onChange(`${newH}:${defaultMinute}`)
  }

  function setMinute(newM) {
    onChange(`${h}:${newM}`)
  }

  return (
    <span className="inline-flex items-center gap-1">
      <select autoFocus={autoFocus} value={h || ''} onChange={(e) => setHour(e.target.value)} className={className}>
        <option value="">{t('Bez času', 'No time')}</option>
        {HOURS.map((hh) => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      {h && (
        <>
          <span className="text-neutral-600">:</span>
          <select value={m || '00'} onChange={(e) => setMinute(e.target.value)} className={className}>
            {MINUTES.map((mm) => <option key={mm} value={mm}>{mm}</option>)}
          </select>
        </>
      )}
    </span>
  )
}
