import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Dumbbell, Mail } from 'lucide-react'
import { diaryResetRequest } from '../../api/client'

export default function DiaryResetRequest() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await diaryResetRequest(email.trim())
    } finally {
      // Vždy stejná zpráva bez ohledu na výsledek — appka ze stejného důvodu nikdy neřekne,
      // jestli daný e-mail existuje (viz backend /diary/reset-request).
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Dumbbell className="text-blood-600" size={26} />
          <span className="font-display text-xl tracking-widest">MŮJ TRÉNINK</span>
        </div>

        {sent ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 mt-8 text-center">
            <Mail className="text-blood-500 mx-auto mb-3" size={28} />
            <p className="text-neutral-300">Pokud k tomuhle e-mailu existuje účet, poslali jsme na něj odkaz pro obnovení hesla.</p>
          </div>
        ) : (
          <>
            <p className="text-center text-neutral-500 text-sm mb-8 mt-2">Zadej e-mail a pošleme ti odkaz na obnovení hesla.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">E-mail</label>
                <input
                  type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-md bg-neutral-900 border border-neutral-800 focus:border-blood-600 outline-none"
                  placeholder="ty@example.com"
                />
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full px-4 py-3 rounded-md bg-blood-700 hover:bg-blood-600 disabled:opacity-50 font-medium transition-colors"
              >
                {loading ? 'Chvilku…' : 'Poslat odkaz'}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-neutral-500 text-sm mt-6">
          <Link to="/diary/login" className="text-blood-500 hover:text-blood-400">Zpět na přihlášení</Link>
        </p>
      </div>
    </div>
  )
}
