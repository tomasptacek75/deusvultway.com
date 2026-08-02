import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Video, Plus, MessageSquare, CheckCircle2, Timer, WifiOff, Clock, MapPin } from 'lucide-react'
import { apiClient } from '../../api/client'
import { logSet, getQueuedCount, initOfflineSync } from '../../offlineQueue'
import CommentThread from '../../components/CommentThread'
import YouTubeEmbed from '../../components/YouTubeEmbed'
import { useLanguage } from '../../i18n/LanguageContext'
import { dayOfWeek, formatDateShort } from '../../utils/date'

export default function WorkoutDetail() {
  const { t, lang } = useLanguage()
  const { id } = useParams()
  const [workout, setWorkout] = useState(null)
  const [restUntil, setRestUntil] = useState(null)
  const [queuedCount, setQueuedCount] = useState(getQueuedCount())
  const [comments, setComments] = useState([])
  const [showComments, setShowComments] = useState(false)

  function load() {
    apiClient.get(`/workouts/${id}`).then((r) => setWorkout(r.data))
  }

  function loadComments() {
    apiClient.get(`/workouts/${id}/comments`).then((r) => setComments(r.data))
  }

  useEffect(load, [id])
  useEffect(loadComments, [id])

  useEffect(() => {
    return initOfflineSync(() => { setQueuedCount(getQueuedCount()); load() })
  }, [id])

  async function completeWorkout() {
    await apiClient.patch(`/workouts/${id}/complete`)
    load()
  }

  async function submitComment(body) {
    await apiClient.post(`/workouts/${id}/comments`, { body })
    loadComments()
  }

  if (!workout) return null

  return (
    <div>
      <Link to="/client/calendar" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white mb-6">
        <ArrowLeft size={16} /> {t('Zpět na kalendář', 'Back to calendar')}
      </Link>

      <div className="text-sm text-neutral-500 flex items-center gap-2 flex-wrap mb-1">
        <span className="whitespace-nowrap">{dayOfWeek(workout.date, lang)} {formatDateShort(workout.date)}</span>
        {workout.time && <span className="flex items-center gap-1 whitespace-nowrap"><Clock size={13} /> {workout.time}</span>}
        {workout.location && <span className="flex items-center gap-1 whitespace-nowrap"><MapPin size={13} /> {workout.location}</span>}
      </div>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-3xl">{workout.title}</h1>
        {workout.status === 'completed' ? (
          <span className="flex items-center gap-1.5 text-sm text-blood-500 shrink-0 mt-1">
            <CheckCircle2 size={16} /> {t('Dokončeno', 'Completed')}
          </span>
        ) : (
          <button
            onClick={completeWorkout}
            className="flex items-center gap-1.5 bg-neutral-800 hover:bg-blood-700 transition-colors rounded-md px-3 py-2 text-sm font-medium shrink-0"
          >
            <CheckCircle2 size={16} /> {t('Dokončit trénink', 'Complete workout')}
          </button>
        )}
      </div>
      {workout.notes && <p className="text-neutral-400 mb-4">{workout.notes}</p>}

      <div className="mb-6">
        <button
          onClick={() => setShowComments((s) => !s)}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white"
        >
          <MessageSquare size={13} />
          {showComments
            ? t('Skrýt komentáře k tréninku', 'Hide workout comments')
            : t('Zobrazit komentáře k tréninku', 'Show workout comments')}
          {comments.length > 0 && ` (${comments.length})`}
        </button>
        {showComments && (
          <CommentThread
            comments={comments}
            onSubmit={submitComment}
            placeholder={t('Napiš komentář k tréninku…', 'Write a comment about this workout…')}
          />
        )}
      </div>

      {queuedCount > 0 && (
        <div className="mb-6 flex items-center gap-2 text-xs text-neutral-400 bg-neutral-900 border border-dashed border-neutral-700 rounded-md px-3 py-2">
          <WifiOff size={14} className="text-blood-500" />
          {queuedCount} {t(queuedCount === 1 ? 'série čeká' : 'série čekají', queuedCount === 1 ? 'set is waiting' : 'sets are waiting')} {t('na odeslání — odešle se automaticky po obnovení připojení.', 'to be sent — it will send automatically once you reconnect.')}
        </div>
      )}

      {restUntil && <RestTimer until={restUntil} onDone={() => setRestUntil(null)} />}

      <div className="space-y-4">
        {workout.exercises.map((we) => (
          <ExerciseCard
            key={we.id}
            we={we}
            onLogged={() => { load(); setQueuedCount(getQueuedCount()) }}
            onSetLogged={() => setRestUntil(Date.now() + 90000)}
          />
        ))}
      </div>
    </div>
  )
}

function RestTimer({ until, onDone }) {
  const { t } = useLanguage()
  const [remaining, setRemaining] = useState(Math.max(0, Math.round((until - Date.now()) / 1000)))

  useEffect(() => {
    const t = setInterval(() => {
      const r = Math.max(0, Math.round((until - Date.now()) / 1000))
      setRemaining(r)
      if (r <= 0) { clearInterval(t); onDone() }
    }, 250)
    return () => clearInterval(t)
  }, [until, onDone])

  const min = Math.floor(remaining / 60)
  const sec = remaining % 60

  return (
    <div className="mb-6 flex items-center justify-between rounded-lg border border-blood-800 bg-blood-900/10 px-4 py-3">
      <div className="flex items-center gap-2 text-blood-400">
        <Timer size={18} />
        <span className="text-sm">{t('Odpočinek', 'Rest')}</span>
      </div>
      <div className="font-display text-2xl tabular-nums">{min}:{String(sec).padStart(2, '0')}</div>
      <button onClick={onDone} className="text-xs text-neutral-500 hover:text-white">{t('Přeskočit', 'Skip')}</button>
    </div>
  )
}

function ExerciseCard({ we, onLogged, onSetLogged }) {
  const { t } = useLanguage()
  const [reps, setReps] = useState(we.target_reps ?? '')
  const [weight, setWeight] = useState(we.target_weight_kg ?? '')
  const [rpe, setRpe] = useState('')
  const [note, setNote] = useState('')
  const [comments, setComments] = useState([])
  const [showComments, setShowComments] = useState(false)

  function loadComments() {
    apiClient.get(`/workout-exercises/${we.id}/comments`).then((r) => setComments(r.data))
  }

  async function logSetForExercise(e) {
    e.preventDefault()
    await logSet(we.id, {
      actual_reps: reps || null,
      actual_weight_kg: weight || null,
      rpe: rpe || null,
      note: note || null,
    })
    setNote('')
    onLogged()
    onSetLogged()
  }

  async function submitComment(body) {
    await apiClient.post(`/workout-exercises/${we.id}/comments`, { body })
    loadComments()
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold text-lg">{t(we.name, we.name_en || we.name)}</div>
          {we.muscle_group && <div className="text-xs text-blood-500 uppercase tracking-wide">{t(we.muscle_group, we.muscle_group_en || we.muscle_group)}</div>}
        </div>
        <div className="text-sm text-neutral-400 text-right">
          {t('Cíl', 'Target')}: {we.target_sets}× {we.target_reps} @ {we.target_weight_kg ?? '—'} kg
          {we.target_rpe && <div className="text-xs text-blood-500">RPE {we.target_rpe}</div>}
        </div>
      </div>

      {we.cues && <p className="text-sm text-neutral-400 mb-3">{t(we.cues, we.cues_en || we.cues)}</p>}

      {we.notes && (
        <div className="mb-3 rounded-md bg-blood-900/10 border border-blood-900/40 p-3 flex gap-2 text-sm text-neutral-300">
          <MessageSquare size={16} className="text-blood-500 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs text-blood-500 uppercase tracking-wide block mb-0.5">{t('Komentář od Davida', 'Comment from David')}</span>
            {we.notes}
          </div>
        </div>
      )}

      {we.video_url ? (
        <div className="mb-4">
          <YouTubeEmbed url={we.video_url} label={t('Zobrazit video', 'View video')} />
        </div>
      ) : (
        <div className="mb-4 rounded-md bg-neutral-950 border border-dashed border-neutral-800 p-4 flex items-center gap-2 text-sm text-neutral-500">
          <Video size={16} />
          {t('Video bude brzy k dispozici', 'Video coming soon')}
        </div>
      )}

      {we.logs?.length > 0 && (
        <div className="mb-3 space-y-1">
          {we.logs.map((l) => (
            <div key={l.id} className="text-xs bg-neutral-800 rounded-md px-3 py-1.5 w-fit max-w-full">
              {t('Série', 'Set')} {l.set_number}: {l.actual_reps ?? '?'}× @ {l.actual_weight_kg ?? '?'} kg
              {l.rpe && <span className="text-blood-400"> · RPE {l.rpe}</span>}
              {l.note && <span className="text-neutral-400"> — „{l.note}“</span>}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={logSetForExercise} className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder={t('opak.', 'reps')}
            className="w-20 bg-neutral-950 border border-neutral-800 rounded-md px-2 py-2 text-sm"
          />
          <span className="text-neutral-600 text-sm">×</span>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="kg"
            className="w-24 bg-neutral-950 border border-neutral-800 rounded-md px-2 py-2 text-sm"
          />
          <input
            type="number"
            min="1"
            max="10"
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
            placeholder="RPE"
            title={t('Vnímaná náročnost (1–10)', 'Perceived exertion (1–10)')}
            className="w-16 bg-neutral-950 border border-neutral-800 rounded-md px-2 py-2 text-sm"
          />
          <button type="submit" className="flex items-center gap-1.5 bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-3 py-2 text-sm font-medium">
            <Plus size={14} /> {t('Zapsat sérii', 'Log set')}
          </button>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('Proč (nepovinné) — např. bolelo koleno, cítil jsem se silně…', 'Why (optional) — e.g. knee hurt, felt strong…')}
          className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-2 py-2 text-sm"
        />
      </form>

      <button
        onClick={() => { setShowComments((s) => !s); if (!showComments) loadComments() }}
        className="mt-3 text-xs text-neutral-500 hover:text-white"
      >
        {showComments ? t('Skrýt komentáře', 'Hide comments') : t('Zobrazit komentáře', 'Show comments')}
      </button>
      {showComments && <CommentThread comments={comments} onSubmit={submitComment} />}
    </div>
  )
}
