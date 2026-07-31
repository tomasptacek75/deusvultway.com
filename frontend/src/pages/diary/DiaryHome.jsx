import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mic, History, Sparkles, PenLine } from 'lucide-react'
import { apiClient } from '../../api/client'

export default function DiaryHome() {
  const [entries, setEntries] = useState(null)

  useEffect(() => {
    apiClient.get('/diary/entries').then((r) => setEntries(r.data.slice(0, 5)))
  }, [])

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <div className="flex flex-col gap-4">
          <Link
            to="/diary/record"
            className="rounded-lg border border-blood-700 bg-blood-900/20 p-6 flex items-start gap-4 hover:bg-blood-900/30 transition-colors"
          >
            <Mic className="text-blood-500 shrink-0" size={28} />
            <div>
              <div className="font-semibold">Namluvit trénink</div>
              <div className="text-sm text-neutral-400">Řekni mi, kdy proběhl trénink, co a jak dlouho, opakování v jednotlivých sériích a jak to šlo — zapíšu to za tebe</div>
            </div>
          </Link>
          <Link
            to="/diary/manual"
            className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 flex items-start gap-4 hover:border-neutral-700 transition-colors"
          >
            <PenLine className="text-blood-500 shrink-0" size={28} />
            <div>
              <div className="font-semibold">Zapsat ručně</div>
              <div className="text-sm text-neutral-400">Nebo to zapiš ty</div>
            </div>
          </Link>
        </div>
        <Link
          to="/diary/next-workout"
          className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 flex items-start gap-4 hover:border-neutral-700 transition-colors"
        >
          <Sparkles className="text-blood-500 shrink-0" size={28} />
          <div>
            <div className="font-semibold">Návrh dalšího tréninku</div>
            <div className="text-sm text-neutral-400">Doporučím ti, co cvičit příště</div>
          </div>
        </Link>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg flex items-center gap-2"><History className="text-blood-600" size={18} /> Poslední záznamy</h2>
          <Link to="/diary/history" className="text-sm text-blood-500 hover:text-blood-400">Celá historie</Link>
        </div>
        <div className="space-y-2">
          {entries?.map((e) => (
            <div key={e.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <div className="text-xs text-neutral-500">{e.recorded_at}</div>
              <div className="text-sm text-neutral-300 mt-1">
                {e.exercises.map((ex) => ex.name).join(', ') || 'Bez cviků'}
              </div>
            </div>
          ))}
          {entries?.length === 0 && (
            <p className="text-neutral-500 text-sm">Zatím žádné záznamy — namluv první trénink.</p>
          )}
          {entries === null && <p className="text-neutral-500 text-sm">Načítám…</p>}
        </div>
      </section>
    </div>
  )
}
