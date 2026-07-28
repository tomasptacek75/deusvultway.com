import { useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'

export default function Billing() {
  const { t } = useLanguage()
  const statusLabel = { active: t('Aktivní', 'Active'), canceled: t('Zrušené', 'Canceled'), past_due: t('Po splatnosti', 'Past due') }
  const [subs, setSubs] = useState([])
  const [payments, setPayments] = useState({})

  useEffect(() => {
    apiClient.get('/subscriptions/me').then(async (r) => {
      setSubs(r.data)
      const entries = await Promise.all(
        r.data.map(async (s) => [s.id, (await apiClient.get('/payments', { params: { subscription_id: s.id } })).data])
      )
      setPayments(Object.fromEntries(entries))
    })
  }, [])

  return (
    <div>
      <h1 className="text-3xl mb-8 flex items-center gap-3">
        <CreditCard className="text-blood-600" /> {t('Platby a předplatné', 'Payments and subscriptions')}
      </h1>

      <div className="space-y-6">
        {subs.map((s) => (
          <div key={s.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-lg">
                {s.plan_name}
                {s.tier && <span className="ml-2 text-xs text-blood-500 uppercase tracking-wide align-middle">{s.tier}</span>}
              </div>
              <span className={`text-xs uppercase tracking-wide px-2 py-1 rounded-md ${s.status === 'active' ? 'text-blood-500 bg-blood-900/20' : 'text-neutral-500 bg-neutral-800'}`}>
                {statusLabel[s.status] ?? s.status}
              </span>
            </div>
            <div className="text-neutral-400 text-sm mb-3">
              {s.price_kc} Kč / {s.billing_period === 'monthly' ? t('měsíc', 'month') : t('jednorázově', 'one-time')}
              {s.current_period_end && <> · {t('další platba do', 'next payment due')} {s.current_period_end}</>}
            </div>
            {payments[s.id]?.length > 0 && (
              <div className="border-t border-neutral-800 pt-3 space-y-1.5">
                {payments[s.id].map((p) => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className="text-neutral-500">{p.paid_at}</span>
                    <span>{p.amount_kc} Kč {p.method && <span className="text-neutral-600">· {p.method}</span>}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {subs.length === 0 && <p className="text-neutral-500">{t('Zatím nemáš žádné aktivní předplatné — domluv se s trenérem.', "You don't have an active subscription yet — talk to your trainer.")}</p>}
      </div>
    </div>
  )
}
