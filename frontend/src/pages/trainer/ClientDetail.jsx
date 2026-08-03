import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Pencil, Check, Send, Clock, MapPin, Camera } from 'lucide-react'
import { apiClient } from '../../api/client'
import Chart from '../../components/Chart'
import AvatarThumb from '../../components/AvatarThumb'
import TimeSelect from '../../components/TimeSelect'
import CommentThread from '../../components/CommentThread'
import { useLanguage } from '../../i18n/LanguageContext'
import { findScheduleConflict } from '../../utils/schedule'
import { dayOfWeek, formatDateShort } from '../../utils/date'

const TAB_KEYS = ['workouts', 'nutrition', 'progress', 'one-rm', 'challenge', 'history', 'billing', 'messages', 'photos', 'equipment']

export default function ClientDetail() {
  const { t } = useLanguage()
  const { id } = useParams()
  const clientId = Number(id)
  const location = useLocation()
  const fromCalendar = location.state?.from === 'calendar'
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab')
  const [tab, setTab] = useState(TAB_KEYS.includes(initialTab) ? initialTab : 'workouts')
  const [client, setClient] = useState(null)

  function loadClient() {
    apiClient.get(`/clients/${clientId}`).then((r) => setClient(r.data))
  }

  useEffect(loadClient, [clientId])

  async function uploadAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('photo', file)
    await apiClient.post(`/users/${clientId}/avatar`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    e.target.value = ''
    loadClient()
  }

  async function updateClientType(clientType) {
    await apiClient.put(`/clients/${clientId}`, { client_type: clientType })
    loadClient()
  }

  return (
    <div>
      <Link to={fromCalendar ? '/trainer/calendar' : '/trainer/clients'} className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white mb-6">
        <ArrowLeft size={16} /> {fromCalendar ? t('Zpět na kalendář', 'Back to calendar') : t('Zpět na klienty', 'Back to clients')}
      </Link>

      {client && (
        <div className="flex items-center gap-4 mb-6">
          <label className="relative group cursor-pointer">
            <AvatarThumb userId={clientId} hasAvatar={client.has_avatar} size={56} />
            <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera size={18} className="text-white" />
            </div>
            <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
          </label>
          <div>
            <div className="font-display text-2xl flex items-center gap-2">
              {client.display_name}
              <select
                value={client.client_type}
                onChange={(e) => updateClientType(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-md px-2 py-0.5 text-xs font-sans"
              >
                <option value="personal">{t('Osobní', 'Personal')}</option>
                <option value="portal">{t('Portál', 'Portal')}</option>
              </select>
            </div>
            <div className="text-sm text-neutral-500 flex flex-col gap-0.5">
              <a href={`mailto:${client.email}`} className="hover:text-white underline-offset-2 hover:underline">
                {client.email}
              </a>
              {client.phone && (
                <a href={`tel:${client.phone}`} className="hover:text-white underline-offset-2 hover:underline">
                  {client.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-8 border-b border-neutral-800 overflow-x-auto">
        {[
          ['workouts', t('Tréninky', 'Workouts')],
          ['nutrition', t('Výživa', 'Nutrition')],
          ['progress', t('Progres', 'Progress')],
          ['one-rm', '6RM/10RM'],
          ['challenge', t('Výzva', 'Challenge')],
          ['history', t('Historie', 'History')],
          ['billing', t('Platby', 'Billing')],
          ['messages', t('Zprávy', 'Messages')],
          ['photos', t('Fotky', 'Photos')],
          ['equipment', t('Vybavení', 'Equipment')],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-blood-600 text-white' : 'border-transparent text-neutral-500 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'workouts' && <WorkoutsTab clientId={clientId} />}
      {tab === 'nutrition' && <NutritionTab clientId={clientId} />}
      {tab === 'progress' && <ProgressTab clientId={clientId} />}
      {tab === 'one-rm' && <RepMaxTab clientId={clientId} />}
      {tab === 'challenge' && <ChallengeTab clientId={clientId} />}
      {tab === 'history' && <HistoryTab clientId={clientId} />}
      {tab === 'billing' && <BillingTab clientId={clientId} />}
      {tab === 'messages' && <MessagesTab clientId={clientId} />}
      {tab === 'photos' && <PhotosTab clientId={clientId} />}
      {tab === 'equipment' && <EquipmentTab clientId={clientId} />}
    </div>
  )
}

function WorkoutsTab({ clientId }) {
  const { t } = useLanguage()
  const [workouts, setWorkouts] = useState([])
  const [exercises, setExercises] = useState([])
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), time: '', location: '', title: '', notes: '' })
  const [expanded, setExpanded] = useState(null)
  const [showArchive, setShowArchive] = useState(false)

  function load() {
    apiClient.get('/workouts', { params: { client_id: clientId } }).then((r) => setWorkouts(r.data))
  }

  useEffect(() => {
    load()
    apiClient.get('/exercises').then((r) => setExercises(r.data))
  }, [clientId])

  async function createWorkout(e) {
    e.preventDefault()
    if (form.time) {
      const conflict = await findScheduleConflict({ date: form.date, time: form.time })
      if (conflict) {
        const proceed = window.confirm(t(
          `Kolize: ${conflict.client_name} má v ${conflict.time} jiný trénink. Přesto uložit?`,
          `Conflict: ${conflict.client_name} already has a workout at ${conflict.time}. Save anyway?`
        ))
        if (!proceed) return
      }
    }
    await apiClient.post('/workouts', { client_id: clientId, ...form, time: form.time || null, location: form.location || null })
    setForm({ date: new Date().toISOString().slice(0, 10), time: '', location: '', title: '', notes: '' })
    load()
  }

  async function deleteWorkout(id) {
    await apiClient.delete(`/workouts/${id}`)
    load()
  }

  async function renameWorkout(id, title) {
    await apiClient.put(`/workouts/${id}`, { title })
    load()
  }

  async function updateWhen(id, date, fields) {
    if (fields.time) {
      const conflict = await findScheduleConflict({ date, time: fields.time, excludeWorkoutId: id })
      if (conflict) {
        const proceed = window.confirm(t(
          `Kolize: ${conflict.client_name} má v ${conflict.time} jiný trénink. Přesto uložit?`,
          `Conflict: ${conflict.client_name} already has a workout at ${conflict.time}. Save anyway?`
        ))
        if (!proceed) return
      }
    }
    await apiClient.put(`/workouts/${id}`, fields)
    load()
  }

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = workouts
    .filter((w) => w.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
  const past = workouts
    .filter((w) => w.date < today)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''))

  return (
    <div>
      <form
        onSubmit={createWorkout}
        className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900 p-5 grid grid-cols-1 md:grid-cols-4 gap-3"
      >
        <input
          type="date"
          required
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
        />
        <TimeSelect
          value={form.time}
          onChange={(v) => setForm({ ...form, time: v })}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
        />
        <input
          required
          placeholder={t('Název tréninku (např. Den A)', 'Workout name (e.g. Day A)')}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 md:col-span-2"
        />
        <input
          placeholder={t('Místo (nepovinné, např. Posilovna Vinohrady)', 'Location (optional, e.g. Vinohrady gym)')}
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 md:col-span-3"
        />
        <button type="submit" className="bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-4 py-2 font-medium flex items-center justify-center gap-1.5">
          <Plus size={16} /> {t('Přidat', 'Add')}
        </button>
      </form>

      <div className="space-y-3">
        {upcoming.map((w) => (
          <WorkoutRow key={w.id} w={w} expanded={expanded} setExpanded={setExpanded} exercises={exercises} updateWhen={updateWhen} renameWorkout={renameWorkout} deleteWorkout={deleteWorkout} />
        ))}
        {upcoming.length === 0 && <p className="text-neutral-500">{t('Žádné nadcházející tréninky.', 'No upcoming workouts.')}</p>}
      </div>

      {past.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchive((s) => !s)}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white"
          >
            {showArchive ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {t('Archiv tréninků', 'Workout archive')} ({past.length})
          </button>
          {showArchive && (
            <div className="space-y-3 mt-3">
              {past.map((w) => (
                <WorkoutRow key={w.id} w={w} expanded={expanded} setExpanded={setExpanded} exercises={exercises} updateWhen={updateWhen} renameWorkout={renameWorkout} deleteWorkout={deleteWorkout} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function WorkoutRow({ w, expanded, setExpanded, exercises, updateWhen, renameWorkout, deleteWorkout }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => setExpanded(expanded === w.id ? null : w.id)}
            className="text-neutral-400 hover:text-white shrink-0"
          >
            {expanded === w.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <div className="flex-1 min-w-0">
            <WorkoutWhen workout={w} onSave={(fields) => updateWhen(w.id, w.date, fields)} />
            <WorkoutTitle title={w.title} onSave={(title) => renameWorkout(w.id, title)} />
          </div>
        </div>
        <button onClick={() => deleteWorkout(w.id)} className="text-neutral-600 hover:text-blood-500 shrink-0">
          <Trash2 size={16} />
        </button>
      </div>
      {expanded === w.id && <WorkoutEditor workoutId={w.id} exercises={exercises} />}
    </div>
  )
}

function WorkoutTitle({ title, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)

  if (editing) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (onSave(value), setEditing(false))}
          className="bg-neutral-950 border border-blood-600 rounded-md px-2 py-1 text-sm font-semibold"
        />
        <button
          onClick={() => { onSave(value); setEditing(false) }}
          className="text-blood-500 hover:text-blood-400"
        >
          <Check size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 group/title mt-0.5">
      <span className="font-semibold">{title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true) }}
        className="text-neutral-600 hover:text-blood-500 opacity-0 group-hover/title:opacity-100 transition-opacity"
      >
        <Pencil size={13} />
      </button>
    </div>
  )
}

function WorkoutWhen({ workout, onSave }) {
  const { t, lang } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [time, setTime] = useState(workout.time || '')
  const [location, setLocation] = useState(workout.location || '')

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
        <TimeSelect
          value={time}
          onChange={setTime}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-1.5 py-0.5 text-xs"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={t('Místo', 'Location')}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-1.5 py-0.5 text-xs w-32"
        />
        <button
          onClick={() => { onSave({ time: time || null, location: location || null }); setEditing(false) }}
          className="text-blood-500 hover:text-blood-400"
        >
          <Check size={14} />
        </button>
      </div>
    )
  }

  return (
    <button onClick={(e) => { e.stopPropagation(); setEditing(true) }} className="flex items-center gap-2 flex-wrap text-xs text-neutral-500 hover:text-neutral-300">
      <span className="whitespace-nowrap">{dayOfWeek(workout.date, lang)} {formatDateShort(workout.date)}</span>
      {workout.time && <span className="flex items-center gap-0.5 whitespace-nowrap"><Clock size={11} /> {workout.time}</span>}
      {workout.location && <span className="flex items-center gap-0.5 whitespace-nowrap"><MapPin size={11} /> {workout.location}</span>}
      {!workout.time && !workout.location && <span className="text-neutral-700 whitespace-nowrap">+ {t('čas / místo', 'time / location')}</span>}
    </button>
  )
}

function WorkoutEditor({ workoutId, exercises }) {
  const { t } = useLanguage()
  const [detail, setDetail] = useState(null)
  const [exerciseId, setExerciseId] = useState('')
  const [sets, setSets] = useState({ target_sets: 3, target_reps: 10, target_weight_kg: '' })
  const [comments, setComments] = useState([])

  function load() {
    apiClient.get(`/workouts/${workoutId}`).then((r) => setDetail(r.data))
  }

  function loadComments() {
    apiClient.get(`/workouts/${workoutId}/comments`).then((r) => setComments(r.data))
  }

  useEffect(load, [workoutId])
  useEffect(loadComments, [workoutId])

  async function submitComment(body) {
    await apiClient.post(`/workouts/${workoutId}/comments`, { body })
    loadComments()
  }

  async function addExercise(e) {
    e.preventDefault()
    if (!exerciseId) return
    await apiClient.post(`/workouts/${workoutId}/exercises`, { exercise_id: Number(exerciseId), ...sets })
    setExerciseId('')
    load()
  }

  async function removeExercise(weId) {
    await apiClient.delete(`/workout-exercises/${weId}`)
    load()
  }

  async function saveComment(weId, notes) {
    await apiClient.put(`/workout-exercises/${weId}`, { notes })
    load()
  }

  if (!detail) return null

  return (
    <div className="border-t border-neutral-800 p-4 space-y-3">
      {detail.exercises.map((we) => (
        <div key={we.id} className="rounded-md bg-neutral-950 border border-neutral-800 p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-medium">{t(we.name, we.name_en || we.name)}</div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {we.target_sets}× {we.target_reps} {t('opak.', 'reps')} @ {we.target_weight_kg ?? '—'} kg
              </div>
              {we.logs?.length > 0 && (
                <div className="text-xs text-blood-400 mt-1 space-y-0.5">
                  {we.logs.map((l) => (
                    <div key={l.id}>
                      {t('Odcvičeno', 'Logged')}: {l.actual_reps ?? '?'}×{l.actual_weight_kg ?? '?'}kg
                      {l.note && <span className="text-neutral-400"> — „{l.note}“</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => removeExercise(we.id)} className="text-neutral-600 hover:text-blood-500 shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
          <TrainerComment weId={we.id} initial={we.notes} onSave={(notes) => saveComment(we.id, notes)} />
        </div>
      ))}

      <form onSubmit={addExercise} className="flex flex-wrap gap-2 items-center pt-2">
        <select
          value={exerciseId}
          onChange={(e) => setExerciseId(e.target.value)}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
        >
          <option value="">{t('Vyber cvik…', 'Select an exercise…')}</option>
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>{t(ex.name, ex.name_en || ex.name)}</option>
          ))}
        </select>
        <input
          type="number"
          value={sets.target_sets}
          onChange={(e) => setSets({ ...sets, target_sets: e.target.value })}
          className="w-20 bg-neutral-950 border border-neutral-800 rounded-md px-2 py-2 text-sm"
          title={t('Série', 'Sets')}
        />
        <span className="text-neutral-600 text-sm">×</span>
        <input
          type="number"
          value={sets.target_reps}
          onChange={(e) => setSets({ ...sets, target_reps: e.target.value })}
          className="w-20 bg-neutral-950 border border-neutral-800 rounded-md px-2 py-2 text-sm"
          title={t('Opakování', 'Reps')}
        />
        <span className="text-neutral-600 text-sm">@</span>
        <input
          type="number"
          placeholder="kg"
          value={sets.target_weight_kg}
          onChange={(e) => setSets({ ...sets, target_weight_kg: e.target.value })}
          className="w-24 bg-neutral-950 border border-neutral-800 rounded-md px-2 py-2 text-sm"
        />
        <button type="submit" className="bg-neutral-800 hover:bg-blood-700 transition-colors rounded-md px-3 py-2 text-sm font-medium">
          {t('Přidat cvik', 'Add exercise')}
        </button>
      </form>

      <CommentThread
        comments={comments}
        onSubmit={submitComment}
        placeholder={t('Napiš komentář k tréninku…', 'Write a comment about this workout…')}
      />
    </div>
  )
}

function TrainerComment({ initial, onSave }) {
  const { t } = useLanguage()
  const [value, setValue] = useState(initial ?? '')
  const [dirty, setDirty] = useState(false)

  return (
    <div className="mt-2 pt-2 border-t border-neutral-800">
      <label className="text-xs text-neutral-500 mb-1 block">{t('Komentář trenéra ke cviku', 'Trainer comment on exercise')}</label>
      <div className="flex gap-2 items-start">
        <textarea
          value={value}
          onChange={(e) => { setValue(e.target.value); setDirty(true) }}
          placeholder={t('Např. na co si dát pozor příště, jak upravit techniku…', 'E.g. what to watch out for next time, how to adjust technique…')}
          rows={1}
          className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-2 py-1.5 text-xs resize-y"
        />
        {dirty && (
          <button
            onClick={() => { onSave(value); setDirty(false) }}
            className="shrink-0 bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-2 py-1.5 text-xs font-medium"
          >
            {t('Uložit', 'Save')}
          </button>
        )}
      </div>
    </div>
  )
}

function NutritionTab({ clientId }) {
  const { t } = useLanguage()
  const [plans, setPlans] = useState([])
  const [form, setForm] = useState({ title: '', notes: '', daily_calories: '', daily_protein_g: '', daily_carbs_g: '', daily_fat_g: '' })

  function load() {
    apiClient.get('/nutrition-plans', { params: { client_id: clientId } }).then((r) => setPlans(r.data))
  }

  useEffect(load, [clientId])

  async function submit(e) {
    e.preventDefault()
    await apiClient.post('/nutrition-plans', { client_id: clientId, ...form })
    setForm({ title: '', notes: '', daily_calories: '', daily_protein_g: '', daily_carbs_g: '', daily_fat_g: '' })
    load()
  }

  return (
    <div>
      <form onSubmit={submit} className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900 p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          required
          placeholder={t('Název plánu (např. Fáze budování síly)', 'Plan name (e.g. Strength building phase)')}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 md:col-span-2"
        />
        <textarea
          placeholder={t('Poznámky / doporučení', 'Notes / recommendations')}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 md:col-span-2"
        />
        <input type="number" placeholder={t('Kalorie/den', 'Calories/day')} value={form.daily_calories} onChange={(e) => setForm({ ...form, daily_calories: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2" />
        <input type="number" placeholder={t('Bílkoviny (g)', 'Protein (g)')} value={form.daily_protein_g} onChange={(e) => setForm({ ...form, daily_protein_g: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2" />
        <input type="number" placeholder={t('Sacharidy (g)', 'Carbs (g)')} value={form.daily_carbs_g} onChange={(e) => setForm({ ...form, daily_carbs_g: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2" />
        <input type="number" placeholder={t('Tuky (g)', 'Fat (g)')} value={form.daily_fat_g} onChange={(e) => setForm({ ...form, daily_fat_g: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2" />
        <button type="submit" className="bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-4 py-2 font-medium md:col-span-2">
          {t('Uložit výživový plán', 'Save nutrition plan')}
        </button>
      </form>

      <div className="space-y-3">
        {plans.map((p) => (
          <div key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <div className="font-semibold mb-1">{p.title}</div>
            {p.notes && <p className="text-sm text-neutral-400 mb-3">{p.notes}</p>}
            <div className="flex gap-4 text-xs text-neutral-500">
              {p.daily_calories && <span>{p.daily_calories} kcal</span>}
              {p.daily_protein_g && <span>{t('B', 'P')}: {p.daily_protein_g}g</span>}
              {p.daily_carbs_g && <span>{t('S', 'C')}: {p.daily_carbs_g}g</span>}
              {p.daily_fat_g && <span>{t('T', 'F')}: {p.daily_fat_g}g</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProgressTab({ clientId }) {
  const { t } = useLanguage()
  const [goals, setGoals] = useState([])
  const [metrics, setMetrics] = useState([])

  useEffect(() => {
    apiClient.get('/goals', { params: { client_id: clientId } }).then((r) => setGoals(r.data))
    apiClient.get('/body-metrics', { params: { client_id: clientId } }).then((r) => setMetrics(r.data))
  }, [clientId])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h3 className="text-lg mb-3">{t('Cíle', 'Goals')}</h3>
        <div className="space-y-2">
          {goals.map((g) => (
            <div key={g.id} className="rounded-md bg-neutral-900 border border-neutral-800 p-3 text-sm">
              <div>{g.description}</div>
              {g.target_date && <div className="text-xs text-neutral-500 mt-1">{t('do', 'by')} {g.target_date}</div>}
            </div>
          ))}
          {goals.length === 0 && <p className="text-neutral-500 text-sm">{t('Klient zatím nezadal cíl.', 'The client has not set a goal yet.')}</p>}
        </div>
      </div>
      <div>
        <h3 className="text-lg mb-3">{t('Váha a míry', 'Weight and measurements')}</h3>
        <div className="space-y-2">
          {metrics.map((m) => (
            <div key={m.id} className="rounded-md bg-neutral-900 border border-neutral-800 p-3 text-sm flex justify-between">
              <span className="text-neutral-500">{m.date}</span>
              <span>{m.weight_kg ? `${m.weight_kg} kg` : '—'}</span>
            </div>
          ))}
          {metrics.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím žádný záznam.', 'No entries yet.')}</p>}
        </div>
      </div>
    </div>
  )
}

// Rep-max (6/10 opakování) místo 1RM — David nechce ruční testování singlů, jen powerlifteři
// je testují. Stejný tvar jako dřívější OneRmTab, jen rep_count navíc a jiný endpoint.
function RepMaxTab({ clientId }) {
  const { t } = useLanguage()
  const [rows, setRows] = useState([])
  const [exercises, setExercises] = useState([])
  const [form, setForm] = useState({ exercise_id: '', rep_count: 6, value_kg: '', recorded_at: new Date().toISOString().slice(0, 10) })

  function load() {
    apiClient.get(`/clients/${clientId}/rep-maxes`).then((r) => setRows(r.data))
  }

  useEffect(() => {
    load()
    apiClient.get('/exercises').then((r) => setExercises(r.data))
  }, [clientId])

  async function submit(e) {
    e.preventDefault()
    if (!form.exercise_id || !form.value_kg) return
    await apiClient.post(`/clients/${clientId}/rep-maxes`, form)
    setForm({ ...form, value_kg: '' })
    load()
  }

  const byExercise = rows.reduce((acc, r) => {
    const key = `${r.exercise_name} — ${r.rep_count}RM`
    acc[key] ??= { nameEn: `${r.exercise_name_en || r.exercise_name} — ${r.rep_count}RM`, values: [] }
    acc[key].values.push(r)
    return acc
  }, {})

  return (
    <div>
      <form onSubmit={submit} className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900 p-5 flex flex-wrap gap-3 items-end">
        <label className="text-xs text-neutral-500 flex flex-col gap-1">{t('Cvik', 'Exercise')}
          <select value={form.exercise_id} onChange={(e) => setForm({ ...form, exercise_id: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm">
            <option value="">{t('Vyber cvik…', 'Select an exercise…')}</option>
            {exercises.map((ex) => <option key={ex.id} value={ex.id}>{t(ex.name, ex.name_en || ex.name)}</option>)}
          </select>
        </label>
        <label className="text-xs text-neutral-500 flex flex-col gap-1">{t('Opakování', 'Reps')}
          <select value={form.rep_count} onChange={(e) => setForm({ ...form, rep_count: Number(e.target.value) })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm">
            <option value={6}>6RM</option>
            <option value={10}>10RM</option>
          </select>
        </label>
        <label className="text-xs text-neutral-500 flex flex-col gap-1">{t('Váha (kg)', 'Weight (kg)')}
          <input type="number" step="0.5" value={form.value_kg} onChange={(e) => setForm({ ...form, value_kg: e.target.value })} className="w-28 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-neutral-500 flex flex-col gap-1">{t('Datum', 'Date')}
          <input type="date" value={form.recorded_at} onChange={(e) => setForm({ ...form, recorded_at: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-4 py-2 text-sm font-medium">{t('Zaznamenat', 'Record')}</button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(byExercise).map(([name, { nameEn, values }]) => (
          <div key={name} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="font-semibold mb-2">{t(name, nameEn || name)}</div>
            {values.length > 1 && <Chart data={values.slice().reverse().map((v) => ({ label: v.recorded_at.slice(5), value: v.value_kg }))} unit=" kg" />}
            <div className="text-xs text-neutral-500 mt-2">{t('Nejnovější', 'Latest')}: {values[0].value_kg} kg ({values[0].recorded_at})</div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím žádný zaznamenaný rep-max.', 'No rep-max recorded yet.')}</p>}
      </div>
    </div>
  )
}

const STATUS_LABELS = { active: ['Aktivní', 'Active'], completed: ['Splněno', 'Completed'], missed: ['Nesplněno', 'Missed'] }

// Měsíční výzva + odměna — jedna výzva na klienta a měsíc (UNIQUE constraint na backendu,
// zachyceno jako 409 na duplicitní POST). Viditelnost ostatním klientům si přepíná klient
// sám na /client/progress, tady jen trenér zakládá a označuje splnění.
function ChallengeTab({ clientId }) {
  const { t } = useLanguage()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ description: '', period_month: new Date().toISOString().slice(0, 7), reward_note: '' })
  const [error, setError] = useState('')

  function load() {
    apiClient.get('/challenges', { params: { client_id: clientId } }).then((r) => setRows(r.data))
  }

  useEffect(load, [clientId])

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!form.description || !form.period_month) return
    try {
      await apiClient.post('/challenges', { ...form, client_id: clientId })
      setForm({ description: '', period_month: new Date().toISOString().slice(0, 7), reward_note: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || t('Nepodařilo se uložit.', 'Could not save.'))
    }
  }

  async function setStatus(id, status) {
    await apiClient.put(`/challenges/${id}/status`, { status })
    load()
  }

  return (
    <div>
      <form onSubmit={submit} className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900 p-5 flex flex-wrap gap-3 items-end">
        <label className="text-xs text-neutral-500 flex flex-col gap-1 flex-1 min-w-[14rem]">{t('Popis výzvy', 'Challenge description')}
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-neutral-500 flex flex-col gap-1">{t('Měsíc', 'Month')}
          <input type="month" value={form.period_month} onChange={(e) => setForm({ ...form, period_month: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-neutral-500 flex flex-col gap-1 flex-1 min-w-[12rem]">{t('Odměna (volitelné)', 'Reward (optional)')}
          <input value={form.reward_note} onChange={(e) => setForm({ ...form, reward_note: e.target.value })} placeholder={t('např. 10% sleva příští měsíc', 'e.g. 10% off next month')} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-4 py-2 text-sm font-medium">{t('Založit výzvu', 'Create challenge')}</button>
        {error && <p className="text-blood-500 text-xs w-full">{error}</p>}
      </form>

      <div className="space-y-3">
        {rows.map((c) => (
          <div key={c.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-neutral-500">{c.period_month}</div>
                <div className="font-semibold">{c.description}</div>
                {c.reward_note && <div className="text-sm text-neutral-400 mt-0.5">{t('Odměna', 'Reward')}: {c.reward_note}</div>}
              </div>
              <span className={`shrink-0 text-xs rounded px-2 py-1 ${c.status === 'completed' ? 'bg-blood-900/40 text-blood-400' : c.status === 'missed' ? 'bg-neutral-800 text-neutral-500' : 'bg-neutral-800 text-neutral-300'}`}>
                {t(...STATUS_LABELS[c.status])}
              </span>
            </div>
            {c.status === 'active' && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => setStatus(c.id, 'completed')} className="text-xs bg-neutral-800 hover:bg-blood-700 transition-colors rounded-md px-3 py-1.5">{t('Označit splněno', 'Mark completed')}</button>
                <button onClick={() => setStatus(c.id, 'missed')} className="text-xs bg-neutral-800 hover:bg-neutral-700 transition-colors rounded-md px-3 py-1.5">{t('Označit nesplněno', 'Mark missed')}</button>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím žádná výzva.', 'No challenge yet.')}</p>}
      </div>
    </div>
  )
}

function HistoryTab({ clientId }) {
  const { t, lang } = useLanguage()
  const [prs, setPrs] = useState([])
  const [workouts, setWorkouts] = useState([])

  useEffect(() => {
    apiClient.get(`/clients/${clientId}/prs`).then((r) => setPrs(r.data))
    apiClient.get(`/clients/${clientId}/history`).then((r) => setWorkouts(r.data))
  }, [clientId])

  return (
    <div>
      <h3 className="text-lg mb-3">{t('Osobní rekordy', 'Personal records')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {prs.map((p) => (
          <div key={p.exercise_id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="font-semibold mb-1">{t(p.exercise_name, p.exercise_name_en || p.exercise_name)}</div>
            <div className="text-xl font-display text-blood-500">{p.best_weight_kg} kg</div>
            <div className="text-xs text-neutral-500">{t('odhad 1RM', 'estimated 1RM')} ~{p.est_1rm} kg</div>
          </div>
        ))}
        {prs.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím žádné zaznamenané série.', 'No sets logged yet.')}</p>}
      </div>

      <h3 className="text-lg mb-3">{t('Dokončené tréninky', 'Completed workouts')}</h3>
      <div className="space-y-2">
        {workouts.map((w) => (
          <div key={w.id} className="rounded-md bg-neutral-900 border border-neutral-800 p-3 text-sm">
            <div className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
              <span className="whitespace-nowrap">{dayOfWeek(w.date, lang)} {formatDateShort(w.date)}</span>
              {w.time && <span className="flex items-center gap-0.5 whitespace-nowrap"><Clock size={11} /> {w.time}</span>}
              {w.location && <span className="flex items-center gap-0.5 whitespace-nowrap"><MapPin size={11} /> {w.location}</span>}
            </div>
            <div className="font-medium mt-0.5">{w.title}</div>
          </div>
        ))}
        {workouts.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím žádný dokončený trénink.', 'No completed workouts yet.')}</p>}
      </div>
    </div>
  )
}

function BillingTab({ clientId }) {
  const { t } = useLanguage()
  const statusLabel = { active: t('Aktivní', 'Active'), canceled: t('Zrušené', 'Canceled'), past_due: t('Po splatnosti', 'Past due') }
  const [subs, setSubs] = useState([])
  const [tiers, setTiers] = useState([])
  const [subForm, setSubForm] = useState({ plan_name: '', price_kc: '', billing_period: 'monthly', current_period_end: '', tier_id: '' })
  const [payForms, setPayForms] = useState({})

  function load() {
    apiClient.get('/subscriptions', { params: { client_id: clientId } }).then((r) => setSubs(r.data))
    apiClient.get('/subscription-tiers').then((r) => setTiers(r.data))
  }

  useEffect(load, [clientId])

  async function createSub(e) {
    e.preventDefault()
    if (!subForm.plan_name || !subForm.price_kc) return
    await apiClient.post('/subscriptions', { client_id: clientId, ...subForm, tier_id: subForm.tier_id || null })
    setSubForm({ plan_name: '', price_kc: '', billing_period: 'monthly', current_period_end: '', tier_id: '' })
    load()
  }

  async function recordPayment(subId) {
    const f = payForms[subId] || {}
    if (!f.amount_kc) return
    await apiClient.post('/payments', { subscription_id: subId, amount_kc: f.amount_kc, paid_at: f.paid_at || new Date().toISOString().slice(0, 10), method: f.method || 'převod' })
    setPayForms({ ...payForms, [subId]: {} })
    load()
  }

  return (
    <div>
      <form onSubmit={createSub} className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900 p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input required placeholder={t('Název plánu', 'Plan name')} value={subForm.plan_name} onChange={(e) => setSubForm({ ...subForm, plan_name: e.target.value })} className="col-span-2 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
        <input required type="number" placeholder="Kč" value={subForm.price_kc} onChange={(e) => setSubForm({ ...subForm, price_kc: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
        <select value={subForm.billing_period} onChange={(e) => setSubForm({ ...subForm, billing_period: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm">
          <option value="monthly">{t('Měsíčně', 'Monthly')}</option>
          <option value="one_time">{t('Jednorázově', 'One-time')}</option>
        </select>
        <input type="date" value={subForm.current_period_end} onChange={(e) => setSubForm({ ...subForm, current_period_end: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm" title={t('Platba do', 'Payment due')} />
        <select value={subForm.tier_id} onChange={(e) => setSubForm({ ...subForm, tier_id: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm">
          <option value="">{t('Bez tieru', 'No tier')}</option>
          {tiers.map((tr) => <option key={tr.id} value={tr.id}>{t(tr.name, tr.name_en || tr.name)}</option>)}
        </select>
        <button type="submit" className="col-span-2 md:col-span-4 bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-4 py-2 text-sm font-medium">{t('Založit předplatné', 'Create subscription')}</button>
      </form>
      <p className="text-xs text-neutral-500 mb-2">{t('Bez napojení na platební bránu — platby se zaznamenávají ručně po přijetí (převod/hotovost).', 'No payment gateway connected — payments are recorded manually after receipt (transfer/cash).')}</p>
      <Link to="/trainer/tiers" className="text-xs text-blood-500 hover:underline mb-6 inline-block">{t('+ Spravovat tiery', '+ Manage tiers')}</Link>

      <div className="space-y-4">
        {subs.map((s) => (
          <div key={s.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">
                {s.plan_name} — {s.price_kc} Kč / {s.billing_period === 'monthly' ? t('měsíc', 'month') : t('jednorázově', 'one-time')}
                {s.tier && <span className="ml-2 text-xs text-blood-500 uppercase tracking-wide align-middle">{s.tier}</span>}
              </div>
              <span className={`text-xs uppercase tracking-wide px-2 py-1 rounded-md ${s.status === 'active' ? 'text-blood-500 bg-blood-900/20' : 'text-neutral-500 bg-neutral-800'}`}>
                {statusLabel[s.status] ?? s.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="number"
                placeholder={t('Kč přijato', 'Kč received')}
                value={payForms[s.id]?.amount_kc || ''}
                onChange={(e) => setPayForms({ ...payForms, [s.id]: { ...payForms[s.id], amount_kc: e.target.value } })}
                className="w-28 bg-neutral-950 border border-neutral-800 rounded-md px-2 py-1.5 text-sm"
              />
              <input
                type="date"
                value={payForms[s.id]?.paid_at || ''}
                onChange={(e) => setPayForms({ ...payForms, [s.id]: { ...payForms[s.id], paid_at: e.target.value } })}
                className="bg-neutral-950 border border-neutral-800 rounded-md px-2 py-1.5 text-sm"
              />
              <button onClick={() => recordPayment(s.id)} className="bg-neutral-800 hover:bg-blood-700 transition-colors rounded-md px-3 py-1.5 text-sm">{t('Zaznamenat platbu', 'Record payment')}</button>
            </div>
          </div>
        ))}
        {subs.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím žádné předplatné.', 'No subscriptions yet.')}</p>}
      </div>
    </div>
  )
}

function MessagesTab({ clientId }) {
  const { t } = useLanguage()
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const bottomRef = useRef(null)

  function load() {
    apiClient.get('/messages', { params: { with: clientId } }).then((r) => setMessages(r.data))
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [clientId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  async function submit(e) {
    e.preventDefault()
    if (!body.trim()) return
    await apiClient.post('/messages', { recipient_id: clientId, body: body.trim() })
    setBody('')
    load()
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 h-[55vh] flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === clientId ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.sender_id === clientId ? 'bg-neutral-800 text-neutral-200' : 'bg-blood-700 text-white'}`}>
              {m.body}
              <div className="text-[10px] opacity-60 mt-1">{m.created_at?.slice(0, 16).replace('T', ' ')}</div>
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-neutral-500 text-sm text-center mt-8">{t('Zatím žádné zprávy.', 'No messages yet.')}</p>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 p-3 border-t border-neutral-800">
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('Napiš zprávu…', 'Write a message…')} className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
        <button type="submit" className="bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-4 py-2 text-sm font-medium flex items-center gap-1.5">
          <Send size={14} /> {t('Odeslat', 'Send')}
        </button>
      </form>
    </div>
  )
}

function PhotoThumb({ id, date }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let objectUrl
    apiClient.get(`/progress-photos/${id}/file`, { responseType: 'blob' }).then((r) => {
      objectUrl = URL.createObjectURL(r.data)
      setUrl(objectUrl)
    })
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [id])
  if (!url) return <div className="w-full h-full bg-neutral-900 animate-pulse" />
  return <img src={url} alt={date} className="w-full h-full object-cover" />
}

function PhotosTab({ clientId }) {
  const { t } = useLanguage()
  const [photos, setPhotos] = useState([])

  useEffect(() => {
    apiClient.get('/progress-photos', { params: { client_id: clientId } }).then((r) => setPhotos(r.data))
  }, [clientId])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {photos.map((p) => (
        <div key={p.id} className="rounded-lg overflow-hidden border border-neutral-800 aspect-square relative">
          <PhotoThumb id={p.id} date={p.date} />
          <div className="absolute inset-x-0 bottom-0 bg-black/70 text-xs px-2 py-1">{p.date}</div>
        </div>
      ))}
      {photos.length === 0 && <p className="text-neutral-500 text-sm col-span-full">{t('Klient zatím nenahrál žádné fotky.', 'The client hasn\'t uploaded any photos yet.')}</p>}
    </div>
  )
}

// Prostředí/vybavení klienta (portál) — výběr ze spravovaného seznamu (equipment_options),
// ne volný text. David tady vidí, s čím klient cvičí, než mu sestaví plán.
// Klient buď trénuje v konkrétní posilovně (vybavení je dané posilovnou, viz Equipment.jsx —
// každá posilovna má vlastní seznam) nebo doma (klient si sám zaškrtne, co má k dispozici,
// z katalogu vybavení). Nikdy obojí najednou — je to buď/anebo podle toho, kde reálně cvičí.
function EquipmentTab({ clientId }) {
  const { t } = useLanguage()
  const [client, setClient] = useState(null)
  const [gyms, setGyms] = useState([])
  const [gymEquipment, setGymEquipment] = useState([])
  const [catalog, setCatalog] = useState([])
  const [homeSelected, setHomeSelected] = useState([])
  const [clientGym, setClientGym] = useState(null)
  const [gymComments, setGymComments] = useState([])

  function load() {
    apiClient.get(`/clients/${clientId}`).then((r) => setClient(r.data))
    apiClient.get('/gyms').then((r) => setGyms(r.data))
    apiClient.get('/equipment-options').then((r) => setCatalog(r.data))
    apiClient.get(`/clients/${clientId}/equipment`).then((r) => setHomeSelected(r.data))
    apiClient.get(`/clients/${clientId}/gym-link`).then((r) => setClientGym(r.data))
    apiClient.get(`/clients/${clientId}/gym-link/comments`).then((r) => setGymComments(r.data))
  }

  useEffect(load, [clientId])

  async function postGymComment(body) {
    await apiClient.post(`/clients/${clientId}/gym-link/comments`, { body })
    apiClient.get(`/clients/${clientId}/gym-link/comments`).then((r) => setGymComments(r.data))
  }

  useEffect(() => {
    if (client?.gym_id) {
      apiClient.get(`/gyms/${client.gym_id}/equipment`).then((r) => setGymEquipment(r.data))
    } else {
      setGymEquipment([])
    }
  }, [client?.gym_id])

  async function setWhere(gymId) {
    await apiClient.put(`/clients/${clientId}`, { gym_id: gymId })
    load()
  }

  async function toggleHome(item, checked) {
    if (checked) {
      await apiClient.post(`/clients/${clientId}/equipment`, { equipment_id: item.id })
    } else {
      await apiClient.delete(`/clients/${clientId}/equipment/${item.id}`)
    }
    load()
  }

  if (!client) return null
  const homeSelectedIds = new Set(homeSelected.map((s) => s.id))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm uppercase tracking-wide text-neutral-500 mb-3">{t('Klientova vlastní posilovna', "Client's own gym")}</h3>
        {clientGym ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="font-medium">{clientGym.name}</div>
            {clientGym.url && (
              <a href={clientGym.url} target="_blank" rel="noreferrer" className="text-blood-500 hover:text-blood-400 text-sm break-all">
                {clientGym.url}
              </a>
            )}
            <CommentThread
              comments={gymComments} onSubmit={postGymComment}
              placeholder={t('Doporuč konkrétní stroj…', 'Recommend a specific machine…')}
            />
          </div>
        ) : (
          <p className="text-neutral-500 text-sm">
            {t('Klient zatím nezadal odkaz na svoji posilovnu.', "Client hasn't submitted their own gym link yet.")}
          </p>
        )}
      </div>

      <div>
        <h3 className="text-sm uppercase tracking-wide text-neutral-500 mb-3">{t('Kde klient cvičí', 'Where the client trains')}</h3>
        <select
          value={client.gym_id ?? ''}
          onChange={(e) => setWhere(e.target.value ? Number(e.target.value) : null)}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
        >
          <option value="">{t('Doma', 'Home')}</option>
          {gyms.map((g) => (
            <option key={g.id} value={g.id}>{t(g.name, g.name_en || g.name)}</option>
          ))}
        </select>
      </div>

      {client.gym_id ? (
        <div>
          <h3 className="text-sm uppercase tracking-wide text-neutral-500 mb-3">
            {t('Vybavení v této posilovně', 'Equipment at this gym')}
          </h3>
          <ul className="space-y-1 text-sm text-neutral-300">
            {gymEquipment.map((o) => <li key={o.id}>{t(o.name, o.name_en || o.name)}</li>)}
            {gymEquipment.length === 0 && <p className="text-neutral-500 text-sm">{t('Tahle posilovna zatím nemá zadané vybavení.', 'This gym has no equipment set yet.')}</p>}
          </ul>
        </div>
      ) : (
        <div>
          <h3 className="text-sm uppercase tracking-wide text-neutral-500 mb-3">{t('Vybavení doma', 'Home equipment')}</h3>
          <div className="space-y-2">
            {catalog.filter((o) => o.active).map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={homeSelectedIds.has(o.id)} onChange={(e) => toggleHome(o, e.target.checked)} />
                {t(o.name, o.name_en || o.name)}
              </label>
            ))}
            {catalog.filter((o) => o.active).length === 0 && <p className="text-neutral-500 text-sm">{t('Žádné vybavení v seznamu.', 'No equipment in the list.')}</p>}
          </div>
        </div>
      )}

      <p className="text-xs text-neutral-600">
        {t('Spravovat seznam posiloven a vybavení lze na stránce Vybavení.', 'Manage the list of gyms and equipment on the Equipment page.')}
      </p>
    </div>
  )
}
