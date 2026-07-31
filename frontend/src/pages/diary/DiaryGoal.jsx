import { useState } from 'react'
import { Target, Check } from 'lucide-react'
import { apiClient, getUser } from '../../api/client'
import DiaryBackLink from '../../components/DiaryBackLink'

const GOALS = [
  { value: 'sila', label: 'Síla', desc: 'Nízké opakování, vysoká váha, dlouhý odpočinek.' },
  { value: 'objem', label: 'Objem', desc: 'Vyšší opakování, kratší odpočinek, více objemu.' },
  { value: 'mix', label: 'Mix', desc: 'Kombinace síly a objemu.' },
]

export default function DiaryGoal() {
  const [goal, setGoal] = useState(getUser()?.diary_goal || 'mix')
  const [saved, setSaved] = useState(false)

  async function save(value) {
    setGoal(value)
    setSaved(false)
    await apiClient.put('/diary/goal', { goal: value })
    const user = getUser()
    localStorage.setItem('bg_user', JSON.stringify({ ...user, diary_goal: value }))
    setSaved(true)
  }

  return (
    <div>
      <DiaryBackLink />
      <h1 className="text-3xl mb-8 flex items-center gap-3">
        <Target className="text-blood-600" /> Tvůj cíl
      </h1>
      <div className="space-y-3 max-w-md">
        {GOALS.map((g) => (
          <button
            key={g.value} onClick={() => save(g.value)}
            className={`w-full text-left px-4 py-3.5 rounded-lg border transition-colors ${
              goal === g.value ? 'bg-blood-900/20 border-blood-700' : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className="font-medium">{g.label}</div>
            <div className="text-sm text-neutral-400 mt-0.5">{g.desc}</div>
          </button>
        ))}
      </div>
      {saved && <p className="text-sm text-neutral-400 mt-4 flex items-center gap-1.5"><Check size={14} /> Uloženo.</p>}
    </div>
  )
}
