import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ArrowRight, Dumbbell, CheckCircle2, Clock, MapPin, Download, Trophy, Sparkles } from 'lucide-react'
import { apiClient, getUser } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import { vocative } from '../../utils/vocative'
import { dayOfWeek, formatDateShort } from '../../utils/date'
import { downloadMyDataExport } from '../../utils/gdprExport'

export default function ClientDashboard() {
  const { t, lang } = useLanguage()
  const user = getUser()
  const firstName = user?.display_name?.split(' ')[0]
  const [workouts, setWorkouts] = useState([])
  const [challenge, setChallenge] = useState(null)
  const [community, setCommunity] = useState([])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const inWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    apiClient.get('/workouts', { params: { from: today, to: inWeek } }).then((r) => setWorkouts(r.data))
    apiClient.get('/challenges', { params: { client_id: user.id } }).then((r) => {
      const thisMonth = new Date().toISOString().slice(0, 7)
      setChallenge(r.data.find((c) => c.period_month === thisMonth) || r.data[0] || null)
    })
    apiClient.get('/challenges/community').then((r) => setCommunity(r.data))
  }, [user.id])

  async function toggleVisibility() {
    if (!challenge) return
    const r = await apiClient.put(`/challenges/${challenge.id}/visibility`, { visibility_opt_in: challenge.visibility_opt_in ? 0 : 1 })
    setChallenge(r.data)
  }

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

      {challenge && (
        <div className="mt-10 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="flex items-center gap-2 text-xs text-blood-500 uppercase tracking-wide mb-2">
            <Trophy size={14} /> {t('Výzva měsíce', 'Challenge of the month')}
          </div>
          <div className="font-semibold">{challenge.description}</div>
          {challenge.reward_note && <div className="text-sm text-neutral-400 mt-1">{t('Odměna', 'Reward')}: {challenge.reward_note}</div>}
          <div className="flex items-center justify-between mt-3">
            <span className={`text-xs rounded px-2 py-1 ${challenge.status === 'completed' ? 'bg-blood-900/40 text-blood-400' : 'bg-neutral-800 text-neutral-300'}`}>
              {challenge.status === 'completed' ? t('Splněno', 'Completed') : challenge.status === 'missed' ? t('Nesplněno', 'Missed') : t('Aktivní', 'Active')}
            </span>
            {challenge.status === 'completed' && (
              <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer">
                <input type="checkbox" checked={!!challenge.visibility_opt_in} onChange={toggleVisibility} />
                {t('Ukázat můj úspěch ostatním', 'Show my success to others')}
              </label>
            )}
          </div>
        </div>
      )}

      {community.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg mb-3 flex items-center gap-2 text-neutral-300">
            <Sparkles size={16} className="text-blood-600" /> {t('Zvládli to ostatní', 'Others made it')}
          </h2>
          <div className="space-y-2">
            {community.map((c, i) => (
              <div key={i} className="rounded-md bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm">
                <span className="font-medium">{c.display_name}</span>
                <span className="text-neutral-400"> — {c.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={downloadMyDataExport}
        className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-400 mt-10"
      >
        <Download size={13} /> {t('Stáhnout moje data (GDPR export)', 'Download my data (GDPR export)')}
      </button>
    </div>
  )
}
