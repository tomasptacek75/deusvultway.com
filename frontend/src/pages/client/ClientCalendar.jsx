import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Clock, MapPin } from 'lucide-react'
import { apiClient } from '../../api/client'
import CalendarView from '../../components/CalendarView'
import { useLanguage } from '../../i18n/LanguageContext'

export default function ClientCalendar() {
  const { t } = useLanguage()
  const [workouts, setWorkouts] = useState([])

  function loadRange(from, to) {
    apiClient.get('/workouts', { params: { from, to } }).then((r) => setWorkouts(r.data))
  }

  return (
    <div>
      <h1 className="text-3xl mb-6 flex items-center gap-3">
        <CalendarDays className="text-blood-600" /> {t('Kalendář tréninků', 'Workout calendar')}
      </h1>
      <CalendarView
        workouts={workouts}
        onRangeChange={loadRange}
        emptyLabel={t('Zatím nemáš žádné naplánované tréninky.', "You don't have any workouts scheduled yet.")}
        renderItem={(w) => (
          <Link
            key={w.id}
            to={`/client/workouts/${w.id}`}
            className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-4 hover:border-blood-600 transition-colors"
          >
            <div>
              <div className="font-medium">{w.title}</div>
              <div className="text-xs text-neutral-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                {w.time && <span className="flex items-center gap-1"><Clock size={11} /> {w.time}</span>}
                {w.location && <span className="flex items-center gap-1"><MapPin size={11} /> {w.location}</span>}
              </div>
            </div>
            <span className="text-xs uppercase tracking-wide text-neutral-500">{w.status}</span>
          </Link>
        )}
      />
    </div>
  )
}
