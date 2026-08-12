import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Clock, MapPin, Check } from 'lucide-react'
import { apiClient } from '../../api/client'
import AvatarThumb from '../../components/AvatarThumb'
import CalendarView from '../../components/CalendarView'
import TimeSelect from '../../components/TimeSelect'
import { useLanguage } from '../../i18n/LanguageContext'
import { SESSION_LENGTH_MIN, addMinutes, findScheduleConflict } from '../../utils/schedule'

// Trenér má víc klientů najednou v jednom přehledu — křestní jméno napřed hned řekne, čí je
// to trénink, aniž by bylo nutné číst celou kartu (T3 přehled).
function firstName(displayName) { return displayName?.split(' ')[0] ?? '' }

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nowHHMM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function useTodayScheduleStatus(workouts) {
  const today = todayISO()
  const now = nowHHMM()
  const todaysSorted = workouts
    .filter((w) => w.date === today && w.time)
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time))

  const current = todaysSorted.find((w) => w.time <= now && now < addMinutes(w.time, SESSION_LENGTH_MIN))
  const next = todaysSorted.find((w) => w.time > now)

  return function getStatus(w) {
    // Celý minulý den (historie) je vždycky šedý, bez ohledu na čas — probíhá/další rozlišení
    // dává smysl jen při pohledu na dnešek.
    if (w.date < today) return 'past'
    if (w.date !== today || !w.time) return 'none'
    if (current && w.id === current.id) return 'current'
    if (next && w.id === next.id) return 'next'
    if (w.time < now) return 'past'
    return 'none'
  }
}

// Pro týdenní/měsíční chip stačí prosté už-bylo/ještě-bude — bez rozlišení "probíhá"/"další",
// to má smysl jen v denním přehledu, kde je víc místa.
function isPastWorkout(w) {
  const today = todayISO()
  if (w.date < today) return true
  if (w.date === today && w.time && w.time < nowHHMM()) return true
  return false
}

export default function TrainerCalendar() {
  const { t } = useLanguage()
  const [workouts, setWorkouts] = useState([])
  const [range, setRange] = useState(null)

  function loadRange(from, to) {
    setRange({ from, to })
    apiClient.get('/schedule', { params: { from, to } }).then((r) => setWorkouts(r.data))
  }

  // Musí vracet promise ze skutečného GET, ne jen "spustit ho na pozadí" — volající kód (viz
  // updateTime) na dokončení reloadu čeká, aby se editor přepnul zpět na zobrazení až s
  // čerstvými daty (jinak krátce bliklo staré, viz EditableTime).
  function reload() {
    if (!range) return Promise.resolve()
    return apiClient.get('/schedule', { params: range }).then((r) => setWorkouts(r.data))
  }

  async function updateTime(id, time) {
    if (time) {
      const workout = workouts.find((w) => w.id === id)
      if (workout) {
        const conflict = await findScheduleConflict({ date: workout.date, time, excludeWorkoutId: id })
        if (conflict) {
          const proceed = window.confirm(t(
            `Kolize: ${conflict.client_name} má v ${conflict.time} jiný trénink. Přesto uložit?`,
            `Conflict: ${conflict.client_name} already has a workout at ${conflict.time}. Save anyway?`
          ))
          if (!proceed) return
        }
      }
    }
    await apiClient.put(`/workouts/${id}`, { time: time || null })
    await reload()
  }

  const getStatus = useTodayScheduleStatus(workouts)

  return (
    <div>
      <h1 className="text-3xl mb-6 flex items-center gap-3">
        <CalendarDays className="text-blood-600" /> {t('Kalendář', 'Calendar')}
      </h1>
      <CalendarView
        workouts={workouts}
        onRangeChange={loadRange}
        emptyLabel={t('Zatím nejsou naplánované žádné tréninky.', 'No workouts scheduled yet.')}
        renderChip={(w) => (
          <span className="truncate">
            {w.time && <span className={isPastWorkout(w) ? 'text-neutral-400' : 'text-blood-400'}>{w.time} </span>}
            <span className="font-medium">
              {w.members.length > 1 ? w.members.map((m) => firstName(m.client_name)).join(', ') : firstName(w.client_name)}
            </span> — {w.title}
          </span>
        )}
        renderMonthChip={(w) => (
          <span className={`font-medium ${isPastWorkout(w) ? 'text-neutral-400' : 'text-blood-400'}`}>{w.time || '—'}</span>
        )}
        renderItem={(w) => {
          const status = getStatus(w)
          const isGroup = w.members.length > 1
          const cardClass = `flex items-center justify-between rounded-lg border p-4 transition-colors ${
            status === 'current'
              ? 'border-blood-600 bg-blood-900/10 hover:border-blood-500'
              : status === 'next'
                ? 'border-blood-800 bg-neutral-900 hover:border-blood-600'
                : status === 'past'
                  ? 'border-neutral-800 bg-neutral-900 opacity-50 hover:border-blood-600'
                  : 'border-neutral-800 bg-neutral-900 hover:border-blood-600'
          }`

          const body = (
            <div className="flex items-center gap-3 min-w-0">
              {isGroup ? (
                <div className="flex items-center shrink-0" style={{ width: 36 + (w.members.length - 1) * 14 }}>
                  {w.members.map((m, i) => (
                    <Link key={m.id} to={`/trainer/clients/${m.client_id}`} state={{ from: 'calendar' }} title={m.client_name}>
                      <AvatarThumb
                        userId={m.client_id}
                        hasAvatar={!!m.client_has_avatar}
                        size={36}
                        className="ring-2 ring-neutral-900 -ml-2 first:ml-0 hover:ring-blood-600 transition-shadow"
                        style={{ zIndex: w.members.length - i }}
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <AvatarThumb userId={w.client_id} hasAvatar={!!w.client_has_avatar} size={36} />
              )}
              <div className="min-w-0">
                <div className="font-medium truncate flex items-center gap-2 flex-wrap">
                  <EditableTime workout={w} onSave={(time) => Promise.all(w.members.map((m) => updateTime(m.id, time)))} />
                  {isGroup ? (
                    <span className="truncate">
                      {w.members.map((m, i) => (
                        <span key={m.id}>
                          {i > 0 && ', '}
                          <Link to={`/trainer/clients/${m.client_id}`} state={{ from: 'calendar' }} className="hover:text-blood-400 hover:underline">
                            {m.client_name}
                          </Link>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="truncate">{w.client_name}</span>
                  )}
                  {status === 'current' && (
                    <span className="text-[10px] uppercase tracking-wide text-blood-400 shrink-0">{t('Probíhá', 'In progress')}</span>
                  )}
                </div>
                <div className="text-sm text-neutral-400 truncate mt-0.5">{w.title}</div>
                {w.location && (
                  <div className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={11} /> {w.location}
                  </div>
                )}
              </div>
            </div>
          )

          return isGroup ? (
            <div key={w.id} className={cardClass}>{body}</div>
          ) : (
            <Link key={w.id} to={`/trainer/clients/${w.client_id}`} state={{ from: 'calendar' }} className={cardClass}>{body}</Link>
          )
        }}
      />
    </div>
  )
}

// Klik na čas přímo v denním přehledu ho umožní upravit bez nutnosti chodit do detailu
// klienta — celá karta je zabalená v <Link>, proto stopPropagation/preventDefault, ať klik
// do editace nespustí navigaci.
function EditableTime({ workout, onSave }) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [time, setTime] = useState(workout.time || '')

  function stop(e) { e.preventDefault(); e.stopPropagation() }

  // Čeká na dokončení uložení (PUT + reload), než se přepne zpět na zobrazení — dřív se
  // setEditing(false) volalo hned, takže krátce po potvrzení appka ukazovala starou hodnotu
  // z ještě nepřenačteného workouts stavu (viditelné hlavně na pomalejší síti).
  async function confirm(e) {
    stop(e)
    setSaving(true)
    try {
      await onSave(time)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <span className="flex items-center gap-1" onClick={stop}>
        <TimeSelect
          autoFocus
          value={time}
          onChange={setTime}
          className="bg-neutral-950 border border-blood-600 rounded px-1.5 py-0.5 text-xs"
        />
        <button
          onClick={confirm}
          disabled={saving}
          className="text-blood-500 hover:text-blood-400 disabled:opacity-50"
        >
          <Check size={13} />
        </button>
      </span>
    )
  }

  return (
    <button onClick={(e) => { stop(e); setEditing(true) }} className="flex items-center gap-1 hover:text-blood-400 transition-colors">
      <Clock size={11} /> {workout.time || t('přidat čas', 'add time')}
    </button>
  )
}
