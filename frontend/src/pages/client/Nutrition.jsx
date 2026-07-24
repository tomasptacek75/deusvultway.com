import { useEffect, useState } from 'react'
import { Apple } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'

export default function Nutrition() {
  const { t } = useLanguage()
  const [plans, setPlans] = useState([])

  useEffect(() => {
    apiClient.get('/nutrition-plans').then((r) => setPlans(r.data))
  }, [])

  return (
    <div>
      <h1 className="text-3xl mb-8 flex items-center gap-3">
        <Apple className="text-blood-600" /> {t('Výživový plán', 'Nutrition plan')}
      </h1>
      <div className="space-y-4">
        {plans.map((p) => (
          <div key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
            <h2 className="text-xl mb-2">{p.title}</h2>
            {p.notes && <p className="text-neutral-400 mb-4 whitespace-pre-line">{p.notes}</p>}
            <div className="flex flex-wrap gap-3">
              {p.daily_calories && <Stat label={t('Kalorie', 'Calories')} value={`${p.daily_calories} kcal`} />}
              {p.daily_protein_g && <Stat label={t('Bílkoviny', 'Protein')} value={`${p.daily_protein_g} g`} />}
              {p.daily_carbs_g && <Stat label={t('Sacharidy', 'Carbs')} value={`${p.daily_carbs_g} g`} />}
              {p.daily_fat_g && <Stat label={t('Tuky', 'Fat')} value={`${p.daily_fat_g} g`} />}
            </div>
          </div>
        ))}
        {plans.length === 0 && <p className="text-neutral-500">{t('Trenér ti zatím nepřiřadil výživový plán.', "Your trainer hasn't assigned a nutrition plan yet.")}</p>}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-md px-4 py-2 text-center">
      <div className="text-xs text-neutral-500 uppercase tracking-wide">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  )
}
