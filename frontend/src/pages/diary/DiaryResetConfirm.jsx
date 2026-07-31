import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Dumbbell, Eye, EyeOff } from 'lucide-react'
import { diaryResetConfirm, homePath } from '../../api/client'

export default function DiaryResetConfirm() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await diaryResetConfirm({ token, password })
      navigate(homePath())
    } catch (err) {
      setError(err.response?.data?.detail || 'Něco se nepovedlo, zkus to prosím znovu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Dumbbell className="text-blood-600" size={26} />
          <span className="font-display text-xl tracking-widest">MŮJ TRÉNINK</span>
        </div>
        <p className="text-center text-neutral-500 text-sm mb-8 mt-2">Nastav si nové heslo.</p>

        {!token && <div className="text-blood-400 text-sm text-center mb-4">Odkaz je neplatný — chybí token.</div>}
        {error && <div className="text-blood-400 text-sm text-center mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Nové heslo</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} required minLength={6} autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 pr-10 rounded-md bg-neutral-900 border border-neutral-800 focus:border-blood-600 outline-none"
                placeholder="aspoň 6 znaků"
              />
              <button
                type="button" onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                tabIndex={-1} aria-label={showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button
            type="submit" disabled={loading || !token}
            className="w-full px-4 py-3 rounded-md bg-blood-700 hover:bg-blood-600 disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? 'Chvilku…' : 'Nastavit heslo'}
          </button>
        </form>

        <p className="text-center text-neutral-500 text-sm mt-6">
          <Link to="/diary/login" className="text-blood-500 hover:text-blood-400">Zpět na přihlášení</Link>
        </p>
      </div>
    </div>
  )
}
