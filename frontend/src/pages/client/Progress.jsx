import { useEffect, useState } from 'react'
import { Target, Scale, TrendingUp, Camera, Trash2, Trophy } from 'lucide-react'
import { apiClient, getUser } from '../../api/client'
import Chart from '../../components/Chart'
import { useLanguage } from '../../i18n/LanguageContext'

export default function Progress() {
  const { t } = useLanguage()
  const user = getUser()
  const [goals, setGoals] = useState([])
  const [metrics, setMetrics] = useState([])
  const [prs, setPrs] = useState([])
  const [photos, setPhotos] = useState([])
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [repMaxes, setRepMaxes] = useState([])
  const [goalForm, setGoalForm] = useState({ description: '', target_value: '', target_date: '' })
  const [metricForm, setMetricForm] = useState({ date: new Date().toISOString().slice(0, 10), weight_kg: '', waist_cm: '', chest_cm: '', hips_cm: '', arm_cm: '', thigh_cm: '' })

  function loadGoals() { apiClient.get('/goals').then((r) => setGoals(r.data)) }
  function loadMetrics() { apiClient.get('/body-metrics').then((r) => setMetrics(r.data)) }
  function loadPrs() { apiClient.get(`/clients/${user.id}/prs`).then((r) => setPrs(r.data)) }
  function loadPhotos() { apiClient.get('/progress-photos').then((r) => setPhotos(r.data)) }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadGoals(); loadMetrics(); loadPrs(); loadPhotos() }, [])

  useEffect(() => {
    if (!selectedExercise) { setRepMaxes([]); return }
    apiClient.get(`/clients/${user.id}/rep-maxes`).then((r) => {
      setRepMaxes(r.data.filter((o) => o.exercise_id === selectedExercise).slice().reverse())
    })
  }, [selectedExercise, user.id])

  async function submitGoal(e) {
    e.preventDefault()
    await apiClient.post('/goals', goalForm)
    setGoalForm({ description: '', target_value: '', target_date: '' })
    loadGoals()
  }

  async function submitMetric(e) {
    e.preventDefault()
    await apiClient.post('/body-metrics', metricForm)
    loadMetrics()
  }

  async function uploadPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('photo', file)
    form.append('date', new Date().toISOString().slice(0, 10))
    await apiClient.post('/progress-photos', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    e.target.value = ''
    loadPhotos()
  }

  async function deletePhoto(id) {
    await apiClient.delete(`/progress-photos/${id}`)
    loadPhotos()
  }

  const weightSeries = metrics.filter((m) => m.weight_kg).map((m) => ({ label: m.date.slice(5), value: m.weight_kg }))

  return (
    <div>
      <h1 className="text-3xl mb-8">{t('Tvůj progres', 'Your progress')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <section>
          <h2 className="text-lg mb-3 flex items-center gap-2"><Target className="text-blood-600" size={18} /> {t('Cíl', 'Goal')}</h2>
          <form onSubmit={submitGoal} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 space-y-2 mb-4">
            <input
              required
              placeholder={t('Popiš svůj cíl (např. Zvednout dřep na 100 kg)', 'Describe your goal (e.g. Squat 100 kg)')}
              value={goalForm.description}
              onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={goalForm.target_date}
                onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
              />
              <button type="submit" className="bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-4 py-2 text-sm font-medium">
                {t('Přidat cíl', 'Add goal')}
              </button>
            </div>
          </form>
          <div className="space-y-2">
            {goals.map((g) => (
              <div key={g.id} className="rounded-md bg-neutral-900 border border-neutral-800 p-3 text-sm">
                {g.description}
                {g.target_date && <span className="text-neutral-500"> · {t('do', 'by')} {g.target_date}</span>}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg mb-3 flex items-center gap-2"><Scale className="text-blood-600" size={18} /> {t('Váha a míry', 'Weight and measurements')}</h2>
          <form onSubmit={submitMetric} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 grid grid-cols-3 gap-2 mb-4">
            <input type="date" value={metricForm.date} onChange={(e) => setMetricForm({ ...metricForm, date: e.target.value })} className="col-span-3 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
            <input type="number" step="0.1" placeholder={t('Váha (kg)', 'Weight (kg)')} value={metricForm.weight_kg} onChange={(e) => setMetricForm({ ...metricForm, weight_kg: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-2 py-2 text-sm" />
            <input type="number" step="0.1" placeholder={t('Pas (cm)', 'Waist (cm)')} value={metricForm.waist_cm} onChange={(e) => setMetricForm({ ...metricForm, waist_cm: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-2 py-2 text-sm" />
            <input type="number" step="0.1" placeholder={t('Hrudník (cm)', 'Chest (cm)')} value={metricForm.chest_cm} onChange={(e) => setMetricForm({ ...metricForm, chest_cm: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-2 py-2 text-sm" />
            <input type="number" step="0.1" placeholder={t('Boky (cm)', 'Hips (cm)')} value={metricForm.hips_cm} onChange={(e) => setMetricForm({ ...metricForm, hips_cm: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-2 py-2 text-sm" />
            <input type="number" step="0.1" placeholder={t('Paže (cm)', 'Arm (cm)')} value={metricForm.arm_cm} onChange={(e) => setMetricForm({ ...metricForm, arm_cm: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-2 py-2 text-sm" />
            <input type="number" step="0.1" placeholder={t('Stehno (cm)', 'Thigh (cm)')} value={metricForm.thigh_cm} onChange={(e) => setMetricForm({ ...metricForm, thigh_cm: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-2 py-2 text-sm" />
            <button type="submit" className="col-span-3 bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-4 py-2 text-sm font-medium">
              {t('Uložit záznam', 'Save entry')}
            </button>
          </form>
          {weightSeries.length > 1 && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 mb-3">
              <Chart data={weightSeries} unit=" kg" />
            </div>
          )}
          <div className="space-y-1.5">
            {metrics.slice().reverse().map((m) => (
              <div key={m.id} className="flex justify-between rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm">
                <span className="text-neutral-500">{m.date}</span>
                <span>{m.weight_kg ? `${m.weight_kg} kg` : '—'}</span>
              </div>
            ))}
            {metrics.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím žádný záznam.', 'No entries yet.')}</p>}
          </div>
        </section>
      </div>

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

      <section className="mb-10">
        <h2 className="text-lg mb-3 flex items-center gap-2"><TrendingUp className="text-blood-600" size={18} /> {t('Vývoj síly (6RM/10RM)', 'Strength progress (6RM/10RM)')}</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {prs.map((p) => (
            <button
              key={p.exercise_id}
              onClick={() => setSelectedExercise(p.exercise_id === selectedExercise ? null : p.exercise_id)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                selectedExercise === p.exercise_id ? 'bg-blood-700 border-blood-600' : 'bg-neutral-900 border-neutral-800 hover:border-blood-700'
              }`}
            >
              {t(p.exercise_name, p.exercise_name_en || p.exercise_name)}
            </button>
          ))}
          {prs.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím nemáš zaznamenané žádné série.', "You don't have any sets logged yet.")}</p>}
        </div>
        {selectedExercise && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 space-y-4">
            {[6, 10].map((rc) => {
              const values = repMaxes.filter((o) => o.rep_count === rc)
              if (values.length === 0) return null
              return (
                <div key={rc}>
                  <div className="text-xs text-neutral-500 mb-1">{rc}RM</div>
                  {values.length > 1
                    ? <Chart data={values.map((o) => ({ label: o.recorded_at.slice(5), value: o.value_kg }))} unit=" kg" />
                    : <div className="text-sm">{values[0].value_kg} kg ({values[0].recorded_at})</div>}
                </div>
              )
            })}
            {repMaxes.length === 0 && (
              <p className="text-neutral-500 text-sm">{t('Trenér ještě nezaznamenal žádný rep-max u tohoto cviku.', 'Your trainer has not logged a rep-max for this exercise yet.')}</p>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg mb-3 flex items-center gap-2"><Camera className="text-blood-600" size={18} /> {t('Fotky pokroku', 'Progress photos')}</h2>
        <label className="inline-block mb-4 cursor-pointer bg-neutral-800 hover:bg-blood-700 transition-colors rounded-md px-4 py-2 text-sm font-medium">
          {t('Nahrát fotku', 'Upload photo')}
          <input type="file" accept="image/*" onChange={uploadPhoto} className="hidden" />
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative group rounded-lg overflow-hidden border border-neutral-800 aspect-square">
              <PhotoThumb id={p.id} date={p.date} />
              <div className="absolute inset-x-0 bottom-0 bg-black/70 text-xs px-2 py-1 flex items-center justify-between">
                <span>{p.date}</span>
                <button onClick={() => deletePhoto(p.id)} className="text-neutral-300 hover:text-blood-500">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {photos.length === 0 && <p className="text-neutral-500 text-sm col-span-full">{t('Zatím žádné fotky.', 'No photos yet.')}</p>}
        </div>
      </section>
    </div>
  )
}

// Fotky jedou přes autentizovaný endpoint (nejsou ve veřejném /public), takže obyčejný <img
// src> by nešel — JWT je jen v Authorization hlavičce, ne v cookie. Stáhneme jako blob a
// zobrazíme přes object URL.
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
