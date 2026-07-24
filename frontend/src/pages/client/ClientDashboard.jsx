import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ArrowRight, Dumbbell, CheckCircle2, Clock, MapPin } from 'lucide-react'
import { apiClient, getUser } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import { vocative } from '../../utils/vocative'
import { dayOfWeek, formatDateShort } from '../../utils/date'

export default function ClientDashboard() {
  const { t, lang } = useLanguage()
  const user = getUser()
  const firstName = user?.display_name?.split(' ')[0]
  const [workouts, setWorkouts] = useState([])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const inWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    apiClient.get('/workouts', { params: { from: today, to: inWeek } }).then((r) => setWorkouts(r.data))
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const todayWorkout = workouts.find((w) => w.date === today)
  const upcoming = workouts.filter((w) => w.date !== today)

  return (
    <div>
      <h1 className="text-3xl mb-2">{t(`Ahoj, ${vocative(firstName)}`, `Hi, ${firstName}`)}</h1>
      <p className="text-neutral-400 mb-8">{t('Tvoje nadcházející tréninky.', 'Your upcoming workouts.')}</p>

      {todayWorkout ? (
        <Link
          to={`/client/workouts/${todayWorkout.id}`}
          className="block mb-8 rounded-xl border border-blood-700 bg-gradient-to-br from-blood-900/30 to-neutral-900 p-6 hover:border-blood-500 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs text-blood-500 uppercase tracking-wide mb-2">
            <Dumbbell size={14} /> {t('Dnešní trénink', "Today's workout")}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-2xl">{todayWorkout.title}</div>
              {(todayWorkout.time || todayWorkout.location) && (
                <div className="flex items-center gap-3 flex-wrap text-xs text-neutral-400 mt-1.5">
                  {todayWorkout.time && <span className="flex items-center gap-1 whitespace-nowrap"><Clock size={12} /> {todayWorkout.time}</span>}
                  {todayWorkout.location && <span className="flex items-center gap-1 whitespace-nowrap"><MapPin size={12} /> {todayWorkout.location}</span>}
                </div>
              )}
              {todayWorkout.status === 'completed' ? (
                <div className="flex items-center gap-1.5 text-sm text-blood-400 mt-1">
                  <CheckCircle2 size={14} /> {t('Dokončeno', 'Completed')}
                </div>
              ) : (
                <div className="text-sm text-neutral-400 mt-1">{t('Klepni pro zahájení', 'Tap to start')}</div>
              )}
            </div>
            <ArrowRight className="text-blood-500" size={24} />
          </div>
        </Link>
      ) : (
        <div className="mb-8 rounded-xl border border-dashed border-neutral-800 p-6 text-neutral-500">
          {t('Dnes nemáš naplánovaný trénink. Odpočiň si, nebo zkontroluj kalendář.', "You don't have a workout scheduled today. Rest up, or check the calendar.")}
        </div>
      )}

      <h2 className="text-lg mb-3 flex items-center gap-2 text-neutral-300">
        <CalendarDays size={16} className="text-blood-600" /> {t('Další dny', 'Upcoming days')}
      </h2>
      <div className="space-y-3">
        {upcoming.map((w) => (
          <Link
            key={w.id}
            to={`/client/workouts/${w.id}`}
            className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-5 hover:border-blood-600 transition-colors"
          >
            <div className="flex items-center gap-3">
              <CalendarDays className="text-blood-600" size={20} />
              <div>
                <div className="text-sm text-neutral-500 flex items-center gap-2 flex-wrap">
                  <span className="whitespace-nowrap">{dayOfWeek(w.date, lang)} {formatDateShort(w.date)}</span>
                  {w.time && <span className="flex items-center gap-0.5 whitespace-nowrap"><Clock size={11} /> {w.time}</span>}
                  {w.location && <span className="flex items-center gap-0.5 whitespace-nowrap"><MapPin size={11} /> {w.location}</span>}
                </div>
                <div className="font-semibold mt-0.5">{w.title}</div>
              </div>
            </div>
            <ArrowRight className="text-neutral-600" size={18} />
          </Link>
        ))}
        {upcoming.length === 0 && <p className="text-neutral-500">{t('V nejbližších dnech nemáš další naplánovaný trénink.', "You don't have any more workouts scheduled in the coming days.")}</p>}
      </div>
    </div>
  )
}
