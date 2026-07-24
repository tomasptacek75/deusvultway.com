import { useEffect, useState } from 'react'
import { History as HistoryIcon, Trophy, ChevronDown, ChevronUp, Clock, MapPin } from 'lucide-react'
import { apiClient, getUser } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import { dayOfWeek, formatDateShort } from '../../utils/date'

export default function History() {
  const { t, lang } = useLanguage()
  const user = getUser()
  const [prs, setPrs] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    apiClient.get(`/clients/${user.id}/prs`).then((r) => setPrs(r.data))
    apiClient.get(`/clients/${user.id}/history`).then((r) => setWorkouts(r.data))
  }, [user.id])

  return (
    <div>
      <h1 className="text-3xl mb-8 flex items-center gap-3">
        <HistoryIcon className="text-blood-600" /> {t('Historie a rekordy', 'History and records')}
      </h1>

      <section className="mb-10">
        <h2 className="text-lg mb-3 flex items-center gap-2"><Trophy className="text-blood-600" size={18} /> {t('Osobní rekordy', 'Personal records')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {prs.map((p) => (
            <div key={p.exercise_id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <div className="font-semibold mb-1">{t(p.exercise_name, p.exercise_name_en || p.exercise_name)}</div>
              <div className="text-2xl font-display text-blood-500">{p.best_weight_kg} kg</div>
              <div className="text-xs text-neutral-500">{p.best_weight_date?.slice(0, 10)}</div>
              <div className="text-xs text-neutral-400 mt-2">{t('Odhad 1RM', 'Estimated 1RM')}: ~{p.est_1rm} kg</div>
            </div>
          ))}
          {prs.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím žádné zaznamenané série.', 'No sets logged yet.')}</p>}
        </div>
      </section>

      <section>
        <h2 className="text-lg mb-3">{t('Dokončené tréninky', 'Completed workouts')}</h2>
        <div className="space-y-2">
          {workouts.map((w) => (
            <div key={w.id} className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === w.id ? null : w.id)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div>
                  <div className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
                    <span className="whitespace-nowrap">{dayOfWeek(w.date, lang)} {formatDateShort(w.date)}</span>
                    {w.time && <span className="flex items-center gap-0.5 whitespace-nowrap"><Clock size={11} /> {w.time}</span>}
                    {w.location && <span className="flex items-center gap-0.5 whitespace-nowrap"><MapPin size={11} /> {w.location}</span>}
                  </div>
                  <div className="font-medium mt-0.5">{w.title}</div>
                </div>
                {expanded === w.id ? <ChevronUp size={18} className="text-neutral-500" /> : <ChevronDown size={18} className="text-neutral-500" />}
              </button>
              {expanded === w.id && (
                <div className="border-t border-neutral-800 p-4 space-y-2">
                  {w.exercises.map((ex) => (
                    <div key={ex.id} className="text-sm">
                      <span className="font-medium">{t(ex.name, ex.name_en || ex.name)}</span>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {ex.logs.map((l) => `${l.actual_reps ?? '?'}×${l.actual_weight_kg ?? '?'}kg`).join(', ') || t('Bez zápisu', 'No log')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {workouts.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím žádný dokončený trénink.', 'No completed workouts yet.')}</p>}
        </div>
      </section>
    </div>
  )
}
