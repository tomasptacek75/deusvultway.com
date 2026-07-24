import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

const DOW_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
const DOW_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS_CS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Datum → 'YYYY-MM-DD' z LOKÁLNÍCH komponent, ne přes toISOString() (ta konvertuje do UTC —
// v časové zóně před UTC, jako je Praha, to posouvá půlnoc o den zpátky a kazí navigaci: den
// vpřed vycházel na stejné datum jako předtím, zpět skákal o dva dny). fromISO() parsuje
// 'YYYY-MM-DDT00:00:00' jako lokální půlnoc, takže musí round-tripovat přes lokální komponenty.
function toISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function fromISO(iso) { return new Date(iso + 'T00:00:00') }
function addDays(iso, n) { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d) }
function addMonths(iso, n) { const d = fromISO(iso); d.setMonth(d.getMonth() + n, 1); return toISO(d) }
function mondayOf(iso) { const d = fromISO(iso); const shift = (d.getDay() + 6) % 7; d.setDate(d.getDate() - shift); return toISO(d) }
function startOfMonth(iso) { const d = fromISO(iso); return toISO(new Date(d.getFullYear(), d.getMonth(), 1)) }

// Sloučí tréninky se stejným časem v rámci dne do jedné položky (skupinová lekce víc
// klientů najednou) — položky bez času se nikdy neslučují (každá zůstává sama za sebe).
function groupByTime(items) {
  const groups = []
  const indexByTime = {}
  for (const w of items) {
    if (!w.time) { groups.push({ ...w, members: [w] }); continue }
    const idx = indexByTime[w.time]
    if (idx === undefined) {
      indexByTime[w.time] = groups.length
      groups.push({ ...w, members: [w] })
    } else {
      groups[idx].members.push(w)
    }
  }
  return groups
}

// Kalendář s přepínačem Den / Týden / Měsíc (S4) — týden a měsíc jsou skutečná mřížka, celá
// se vejde na jednu obrazovku (bez scrollování přes jednotlivé dny jako dřív), s kompaktním
// výpisem tréninků na den. Klik na den v týdenním/měsíčním přehledu přepne do denního režimu
// s plným detailem (renderItem) pro ten konkrétní den.
export default function CalendarView({ workouts, onRangeChange, getDate = (w) => w.date, renderItem, renderChip, renderMonthChip, emptyLabel }) {
  const { t, lang } = useLanguage()
  const DOW = lang === 'en' ? DOW_EN : DOW_CS
  const MONTHS = lang === 'en' ? MONTHS_EN : MONTHS_CS
  const MODE_LABEL = { day: t('Den', 'Day'), week: t('Týden', 'Week'), month: t('Měsíc', 'Month') }

  const [mode, setMode] = useState('day')
  const [anchor, setAnchor] = useState(toISO(new Date()))
  const today = toISO(new Date())

  const gridStart = mode === 'day' ? anchor : mode === 'week' ? mondayOf(anchor) : mondayOf(startOfMonth(anchor))
  const gridDays = mode === 'day' ? 1 : mode === 'week' ? 7 : 42
  const from = gridStart
  const to = addDays(gridStart, gridDays - 1)

  useEffect(() => { onRangeChange(from, to) }, [from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  const byDate = {}
  for (const w of workouts) { (byDate[getDate(w)] ??= []).push(w) }
  // Řadit chronologicky podle času — bez tohohle byly položky v pořadí, v jakém je vrátilo API
  // (typicky podle ID), ne podle skutečného pořadí v rámci dne. Bez času jdou na konec.
  for (const key of Object.keys(byDate)) {
    byDate[key].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
    // Skupinová lekce — víc klientů ve stejný čas — se má zobrazit jako jeden řádek/chip, ne
    // jako duplicitní položky vedle sebe. `members` nese všechny sdílející ten čas, ostatní
    // pole (title/location/status/...) se přebírají z prvního člena.
    byDate[key] = groupByTime(byDate[key])
  }

  function nav(dir) {
    if (mode === 'day') setAnchor((a) => addDays(a, dir))
    else if (mode === 'week') setAnchor((a) => addDays(a, dir * 7))
    else setAnchor((a) => addMonths(a, dir))
  }

  function goToday() { setAnchor(today) }
  function openDay(iso) { setAnchor(iso); setMode('day') }

  const anchorD = fromISO(anchor)
  const label = mode === 'month'
    ? `${MONTHS[anchorD.getMonth()]} ${anchorD.getFullYear()}`
    : mode === 'week'
      ? `${fromISO(gridStart).getDate()}. ${MONTHS[fromISO(gridStart).getMonth()].slice(0, 3)} – ${fromISO(to).getDate()}. ${MONTHS[fromISO(to).getMonth()].slice(0, 3)}`
      : anchorD.toLocaleDateString(lang === 'en' ? 'en-GB' : 'cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })

  const chip = renderChip || ((w) => (
    <span className="truncate">{w.time && <span className="text-blood-400">{w.time} </span>}{w.title}</span>
  ))
  // Měsíční buňky jsou úzké (7 sloupců i na mobilu) — na rozdíl od týdenního/denního chipu tu
  // jde primárně o to vidět VŠECHNY časy toho dne bez oříznutí, ne celý název/klienta.
  const monthChip = renderMonthChip || ((w) => <span>{w.time || '—'}</span>)

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => nav(-1)} className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400" aria-label={t('Předchozí', 'Previous')}>
            <ChevronLeft size={18} />
          </button>
          <button onClick={goToday} className="text-xs px-2.5 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 transition-colors">
            {t('Dnes', 'Today')}
          </button>
          <button onClick={() => nav(1)} className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400" aria-label={t('Další', 'Next')}>
            <ChevronRight size={18} />
          </button>
          <span className="text-sm text-neutral-300 ml-2 capitalize">{label}</span>
        </div>
        <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-md p-1">
          {Object.entries(MODE_LABEL).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${mode === k ? 'bg-blood-700 text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {mode === 'month' && (
        <MonthGrid start={gridStart} month={anchorD.getMonth()} today={today} byDate={byDate} chip={monthChip} onOpenDay={openDay} dow={DOW} />
      )}
      {mode === 'week' && (
        <WeekGrid start={gridStart} today={today} byDate={byDate} chip={chip} onOpenDay={openDay} dow={DOW} />
      )}
      {mode === 'day' && (
        <div className="space-y-2">
          {(byDate[anchor] || []).map((w) => renderItem(w))}
          {!(byDate[anchor]?.length) && <p className="text-neutral-500">{emptyLabel ?? t('Žádné tréninky v tomto období.', 'No workouts in this period.')}</p>}
        </div>
      )}
    </div>
  )
}

function MonthGrid({ start, month, today, byDate, chip, onOpenDay, dow }) {
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  return (
    <div className="rounded-lg border border-neutral-800 overflow-hidden">
      <div className="grid grid-cols-7 bg-neutral-900">
        {dow.map((d) => (
          <div key={d} className="text-[11px] text-neutral-500 uppercase tracking-wide px-2 py-1.5 text-center border-b border-neutral-800">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((iso) => {
          const items = byDate[iso] || []
          const inMonth = fromISO(iso).getMonth() === month
          return (
            <button
              key={iso}
              onClick={() => onOpenDay(iso)}
              className={`text-left border-b border-r border-neutral-800 p-1 sm:p-1.5 min-h-[64px] sm:min-h-[88px] flex flex-col hover:bg-neutral-900 transition-colors ${inMonth ? '' : 'bg-neutral-950/60'}`}
            >
              <span className={`text-[11px] mb-0.5 ${iso === today ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-blood-700 text-white font-semibold' : inMonth ? 'text-neutral-400' : 'text-neutral-700'}`}>
                {fromISO(iso).getDate()}
              </span>
              <div className="space-y-0.5">
                {items.map((w) => (
                  <div key={w.id} className="text-[10px] bg-neutral-800 rounded px-1 py-0.5">{chip(w)}</div>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WeekGrid({ start, today, byDate, chip, onOpenDay, dow }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const todayRef = useRef(null)

  // Na mobilu se týden zobrazuje jako sloupec 7 karet pod sebou (viz responzivní grid níž) —
  // bez tohohle by dnešek mohl být kdekoliv uprostřed a trenér by ho musel hledat scrollem.
  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [start])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
      {days.map((iso) => {
        const items = byDate[iso] || []
        return (
          <button
            key={iso}
            ref={iso === today ? todayRef : null}
            onClick={() => onOpenDay(iso)}
            className={`text-left rounded-lg border p-2 min-h-[64px] sm:min-h-[220px] flex flex-col hover:border-blood-700 transition-colors ${iso === today ? 'border-blood-700 bg-blood-900/10' : 'border-neutral-800 bg-neutral-900'}`}
          >
            <div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">{dow[(fromISO(iso).getDay() + 6) % 7]}</div>
            <div className={`text-sm mb-2 ${iso === today ? 'text-blood-500 font-semibold' : 'text-neutral-300'}`}>{fromISO(iso).getDate()}</div>
            <div className="space-y-1 overflow-hidden">
              {items.map((w) => (
                <div key={w.id} className="text-[11px] bg-neutral-800 rounded px-1.5 py-1 truncate">{chip(w)}</div>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
