import { useEffect, useMemo, useState } from 'react'
import { Dumbbell, Search } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import YouTubeEmbed from '../../components/YouTubeEmbed'

export default function ExerciseLibrary() {
  const { t } = useLanguage()
  const [exercises, setExercises] = useState([])
  const [search, setSearch] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('')

  useEffect(() => {
    apiClient.get('/exercises').then((r) => setExercises(r.data))
  }, [])

  const muscleGroups = useMemo(
    () => [...new Set(exercises.map((ex) => ex.muscle_group).filter(Boolean))],
    [exercises]
  )

  const filtered = exercises.filter((ex) => {
    if (muscleGroup && ex.muscle_group !== muscleGroup) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (ex.name || '').toLowerCase().includes(q) || (ex.name_en || '').toLowerCase().includes(q)
  })

  return (
    <div>
      <h1 className="text-3xl mb-8 flex items-center gap-3">
        <Dumbbell className="text-blood-600" /> {t('Knihovna cviků', 'Exercise library')}
      </h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Hledat cvik…', 'Search exercises…')}
            className="pl-9 pr-3 py-2 rounded-md bg-neutral-900 border border-neutral-800 text-sm w-56"
          />
        </div>
        <select
          value={muscleGroup}
          onChange={(e) => setMuscleGroup(e.target.value)}
          className="px-3 py-2 rounded-md bg-neutral-900 border border-neutral-800 text-sm"
        >
          <option value="">{t('Všechny svalové skupiny', 'All muscle groups')}</option>
          {muscleGroups.map((mg) => (
            <option key={mg} value={mg}>{t(mg, exercises.find((ex) => ex.muscle_group === mg)?.muscle_group_en || mg)}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((ex) => (
          <div key={ex.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="font-semibold">{t(ex.name, ex.name_en || ex.name)}</div>
            {(ex.muscle_group || ex.category) && (
              <div className="text-xs text-blood-500 uppercase tracking-wide mt-0.5 mb-2">
                {[t(ex.muscle_group, ex.muscle_group_en || ex.muscle_group), ex.category].filter(Boolean).join(' · ')}
              </div>
            )}
            {ex.video_url && (
              <div className="mb-2">
                <YouTubeEmbed url={ex.video_url} label={t('Otevřít video', 'Open video')} />
              </div>
            )}
            {ex.cues && <p className="text-sm text-neutral-400">{t(ex.cues, ex.cues_en || ex.cues)}</p>}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-neutral-500 text-sm col-span-full">{t('Žádné cviky neodpovídají filtru.', 'No exercises match the filter.')}</p>}
      </div>
    </div>
  )
}
