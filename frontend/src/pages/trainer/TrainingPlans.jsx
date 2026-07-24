import { useEffect, useState } from 'react'
import { ClipboardList, Plus, Trash2, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'

export default function TrainingPlans() {
  const { t } = useLanguage()
  const [plans, setPlans] = useState([])
  const [clients, setClients] = useState([])
  const [teams, setTeams] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', target: '' })

  function load() {
    apiClient.get('/training-plans').then((r) => setPlans(r.data))
  }

  useEffect(() => {
    load()
    apiClient.get('/clients').then((r) => setClients(r.data))
    apiClient.get('/teams').then((r) => setTeams(r.data))
  }, [])

  async function createPlan(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.target) return
    const [kind, id] = form.target.split(':')
    const payload = { name: form.name.trim(), description: form.description || null }
    if (kind === 'client') payload.client_id = Number(id)
    if (kind === 'team') payload.team_id = Number(id)
    await apiClient.post('/training-plans', payload)
    setForm({ name: '', description: '', target: '' })
    load()
  }

  async function deletePlan(id) {
    await apiClient.delete(`/training-plans/${id}`)
    load()
  }

  return (
    <div>
      <h1 className="text-3xl mb-6 flex items-center gap-3">
        <ClipboardList className="text-blood-600" /> {t('Tréninkové plány', 'Training plans')}
      </h1>

      <form onSubmit={createPlan} className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900 p-5 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          required
          placeholder={t('Název plánu (např. Síla — podzim)', 'Plan name (e.g. Strength — autumn)')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 md:col-span-2"
        />
        <select
          required
          value={form.target}
          onChange={(e) => setForm({ ...form, target: e.target.value })}
          className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
        >
          <option value="">{t('Pro koho…', 'For whom…')}</option>
          <optgroup label={t('Klient', 'Client')}>
            {clients.map((c) => <option key={`c${c.id}`} value={`client:${c.id}`}>{c.display_name}</option>)}
          </optgroup>
          <optgroup label={t('Tým', 'Team')}>
            {teams.map((team) => <option key={`t${team.id}`} value={`team:${team.id}`}>{team.name}</option>)}
          </optgroup>
        </select>
        <button type="submit" className="flex items-center justify-center gap-1.5 bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-4 py-2 font-medium">
          <Plus size={16} /> {t('Vytvořit plán', 'Create plan')}
        </button>
      </form>

      <div className="space-y-3">
        {plans.map((p) => (
          <div key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="flex items-center gap-3 flex-1 text-left">
                {expanded === p.id ? <ChevronUp size={18} className="text-neutral-500" /> : <ChevronDown size={18} className="text-neutral-500" />}
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-neutral-500">
                    {p.team_id ? teams.find((team) => team.id === p.team_id)?.name : clients.find((c) => c.id === p.client_id)?.display_name}
                  </div>
                </div>
              </button>
              <button onClick={() => deletePlan(p.id)} className="text-neutral-600 hover:text-blood-500">
                <Trash2 size={16} />
              </button>
            </div>
            {expanded === p.id && <PlanEditor planId={p.id} />}
          </div>
        ))}
        {plans.length === 0 && <p className="text-neutral-500">{t('Zatím žádné tréninkové plány.', 'No training plans yet.')}</p>}
      </div>
    </div>
  )
}

function PlanEditor({ planId }) {
  const { t } = useLanguage()
  const [plan, setPlan] = useState(null)
  const [form, setForm] = useState({ name: '', weeks: 4, days_per_week: 1, progression_type: 'manual', target_rpe: '', percent_1rm_start: '', percent_1rm_end: '', start_date: new Date().toISOString().slice(0, 10) })

  function load() {
    apiClient.get(`/training-plans/${planId}`).then((r) => setPlan(r.data))
  }

  useEffect(load, [planId])

  async function addBlock(e) {
    e.preventDefault()
    await apiClient.post(`/training-plans/${planId}/blocks`, form)
    setForm({ ...form, name: '' })
    load()
  }

  async function deleteBlock(id) {
    await apiClient.delete(`/plan-blocks/${id}`)
    load()
  }

  if (!plan) return null

  return (
    <div className="border-t border-neutral-800 p-4 space-y-4">
      {plan.blocks.map((b) => <BlockEditor key={b.id} block={b} onChange={load} onDelete={() => deleteBlock(b.id)} />)}

      <form onSubmit={addBlock} className="rounded-md bg-neutral-950 border border-dashed border-neutral-800 p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <input required placeholder={t('Název bloku (např. Blok 1 — akumulace)', 'Block name (e.g. Block 1 — accumulation)')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="col-span-2 md:col-span-4 bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-sm" />
        <label className="text-xs text-neutral-500 flex flex-col gap-1">{t('Týdnů', 'Weeks')}
          <input type="number" min="1" value={form.weeks} onChange={(e) => setForm({ ...form, weeks: e.target.value })} className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-neutral-500 flex flex-col gap-1">{t('Tréninkových dnů/týden', 'Training days/week')}
          <input type="number" min="1" max="7" value={form.days_per_week} onChange={(e) => setForm({ ...form, days_per_week: e.target.value })} className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-neutral-500 flex flex-col gap-1">{t('Progrese', 'Progression')}
          <select value={form.progression_type} onChange={(e) => setForm({ ...form, progression_type: e.target.value })} className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-sm">
            <option value="manual">{t('Ruční (váhu doplní trenér)', 'Manual (trainer fills in weight)')}</option>
            <option value="rpe">{t('Dle RPE', 'By RPE')}</option>
            <option value="percent_1rm">% {t('z 1RM', 'of 1RM')}</option>
          </select>
        </label>
        <label className="text-xs text-neutral-500 flex flex-col gap-1">{t('Začátek', 'Start')}
          <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-sm" />
        </label>
        {form.progression_type === 'rpe' && (
          <label className="text-xs text-neutral-500 flex flex-col gap-1">{t('Cílové RPE', 'Target RPE')}
            <input type="number" min="1" max="10" value={form.target_rpe} onChange={(e) => setForm({ ...form, target_rpe: e.target.value })} className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-sm" />
          </label>
        )}
        {form.progression_type === 'percent_1rm' && (
          <>
            <label className="text-xs text-neutral-500 flex flex-col gap-1">{t('% 1RM na začátku', '% 1RM at start')}
              <input type="number" value={form.percent_1rm_start} onChange={(e) => setForm({ ...form, percent_1rm_start: e.target.value })} className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-neutral-500 flex flex-col gap-1">{t('% 1RM na konci', '% 1RM at end')}
              <input type="number" value={form.percent_1rm_end} onChange={(e) => setForm({ ...form, percent_1rm_end: e.target.value })} className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-sm" />
            </label>
          </>
        )}
        <button type="submit" className="col-span-2 md:col-span-4 flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-blood-700 transition-colors rounded-md px-3 py-2 text-sm font-medium">
          <Plus size={14} /> {t('Přidat blok', 'Add block')}
        </button>
      </form>
    </div>
  )
}

function BlockEditor({ block, onChange, onDelete }) {
  const { t } = useLanguage()
  const progressionLabel = { manual: t('Ruční', 'Manual'), rpe: 'RPE', percent_1rm: `% ${t('z 1RM', 'of 1RM')}` }
  const [exercises, setExercises] = useState([])
  const [form, setForm] = useState({ exercise_id: '', day_of_week: 1, target_sets: 3, target_reps: 8 })
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => { apiClient.get('/exercises').then((r) => setExercises(r.data)) }, [])

  async function addExercise(e) {
    e.preventDefault()
    if (!form.exercise_id) return
    await apiClient.post(`/plan-blocks/${block.id}/exercises`, form)
    onChange()
  }

  async function removeExercise(id) {
    await apiClient.delete(`/block-exercises/${id}`)
    onChange()
  }

  async function generate() {
    setGenerating(true)
    setResult(null)
    const { data } = await apiClient.post(`/plan-blocks/${block.id}/generate-workouts`)
    setResult(data)
    setGenerating(false)
  }

  return (
    <div className="rounded-md bg-neutral-950 border border-neutral-800 p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-medium">{block.name}</div>
          <div className="text-xs text-neutral-500">
            {block.weeks} {t('týdnů', 'weeks')} · {progressionLabel[block.progression_type]}
            {block.progression_type === 'percent_1rm' && ` (${block.percent_1rm_start}→${block.percent_1rm_end} %)`}
            {block.progression_type === 'rpe' && ` (RPE ${block.target_rpe})`}
            {' '}· {t('od', 'from')} {block.start_date}
          </div>
        </div>
        <button onClick={onDelete} className="text-neutral-600 hover:text-blood-500 shrink-0"><Trash2 size={14} /></button>
      </div>

      <div className="space-y-1 mb-3">
        {block.exercises.map((ex) => (
          <div key={ex.id} className="flex items-center justify-between text-sm bg-neutral-900 border border-neutral-800 rounded-md px-3 py-1.5">
            <span>{t('Den', 'Day')} {ex.day_of_week} · {t(ex.exercise_name, ex.exercise_name_en || ex.exercise_name)} — {ex.target_sets}×{ex.target_reps}</span>
            <button onClick={() => removeExercise(ex.id)} className="text-neutral-600 hover:text-blood-500"><Trash2 size={13} /></button>
          </div>
        ))}
        {block.exercises.length === 0 && <p className="text-neutral-500 text-xs">{t('Blok zatím nemá žádné cviky.', 'This block has no exercises yet.')}</p>}
      </div>

      <form onSubmit={addExercise} className="flex flex-wrap gap-2 items-center mb-3">
        <select value={form.exercise_id} onChange={(e) => setForm({ ...form, exercise_id: e.target.value })} className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-xs">
          <option value="">{t('Cvik…', 'Exercise…')}</option>
          {exercises.map((ex) => <option key={ex.id} value={ex.id}>{t(ex.name, ex.name_en || ex.name)}</option>)}
        </select>
        <input type="number" min="1" max="7" value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })} title={t('Den v týdnu (1–7)', 'Day of week (1–7)')} className="w-14 bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-xs" />
        <input type="number" value={form.target_sets} onChange={(e) => setForm({ ...form, target_sets: e.target.value })} title={t('Série', 'Sets')} className="w-14 bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-xs" />
        <span className="text-neutral-600 text-xs">×</span>
        <input type="number" value={form.target_reps} onChange={(e) => setForm({ ...form, target_reps: e.target.value })} title={t('Opakování', 'Reps')} className="w-14 bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-xs" />
        <button type="submit" className="bg-neutral-800 hover:bg-blood-700 transition-colors rounded-md px-2.5 py-1.5 text-xs font-medium">{t('Přidat cvik', 'Add exercise')}</button>
      </form>

      <button
        onClick={generate}
        disabled={generating || block.exercises.length === 0}
        className="flex items-center gap-1.5 bg-blood-700 hover:bg-blood-600 transition-colors disabled:opacity-40 rounded-md px-3 py-2 text-sm font-medium"
      >
        <Zap size={14} /> {generating ? t('Generuji…', 'Generating…') : t('Generovat tréninky', 'Generate workouts')}
      </button>
      {result && <p className="text-xs text-neutral-500 mt-2">{t('Vygenerováno', 'Generated')} {result.workouts_created} {t('tréninků.', 'workouts.')}</p>}
    </div>
  )
}
