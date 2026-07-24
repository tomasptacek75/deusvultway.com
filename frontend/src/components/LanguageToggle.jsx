import { useLanguage } from '../i18n/LanguageContext'

// Unicode vlajkové emoji (🇬🇧/🇨🇿) na Windows nemají font s glyfy a vykreslí se jen jako
// písmenka "GB"/"CZ" — proto skutečné SVG vlajky, stejný vzhled na všech platformách.
function CzechFlag({ size = 20 }) {
  return (
    <svg width={size} height={(size * 2) / 3} viewBox="0 0 30 20" aria-hidden="true">
      <rect width="30" height="20" fill="#fff" />
      <rect y="10" width="30" height="10" fill="#D7141A" />
      <polygon points="0,0 0,20 15,10" fill="#11457E" />
    </svg>
  )
}

function UkFlag({ size = 20 }) {
  return (
    <svg width={size} height={(size * 2) / 3} viewBox="0 0 30 20" aria-hidden="true">
      <rect width="30" height="20" fill="#00247D" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#fff" strokeWidth="4" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#CF142B" strokeWidth="2" />
      <path d="M15,0 V20 M0,10 H30" stroke="#fff" strokeWidth="6" />
      <path d="M15,0 V20 M0,10 H30" stroke="#CF142B" strokeWidth="3.6" />
    </svg>
  )
}

export default function LanguageToggle({ className = '' }) {
  const { lang, toggle } = useLanguage()
  return (
    <button
      onClick={toggle}
      title={lang === 'cs' ? 'Switch to English' : 'Přepnout na češtinu'}
      aria-label={lang === 'cs' ? 'Switch to English' : 'Přepnout na češtinu'}
      className={`inline-flex overflow-hidden rounded-[3px] ring-1 ring-white/10 hover:scale-110 transition-transform ${className}`}
    >
      {lang === 'cs' ? <UkFlag size={22} /> : <CzechFlag size={22} />}
    </button>
  )
}
