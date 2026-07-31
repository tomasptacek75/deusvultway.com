import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Dumbbell, Eye, EyeOff } from 'lucide-react'
import { diaryRegister, homePath } from '../../api/client'

const GOALS = [
  { value: 'sila', label: 'Síla' },
  { value: 'objem', label: 'Objem' },
  { value: 'mix', label: 'Mix' },
]

export default function DiaryRegister() {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [goal, setGoal] = useState('mix')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await diaryRegister({ email: email.trim(), display_name: displayName.trim(), goal, password })
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
        <p className="text-center text-neutral-500 text-sm mb-8">
          Hlasový tréninkový deník s AI. Založ si účet a namluv první trénink.
        </p>

        {error && <div className="text-blood-400 text-sm text-center mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Jméno</label>
            <input
              type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-md bg-neutral-900 border border-neutral-800 focus:border-blood-600 outline-none"
              placeholder="Jak ti máme říkat"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">E-mail</label>
            <input
              type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-md bg-neutral-900 border border-neutral-800 focus:border-blood-600 outline-none"
              placeholder="ty@example.com"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Heslo</label>
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
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Tvůj cíl</label>
            <div className="grid grid-cols-3 gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.value} type="button" onClick={() => setGoal(g.value)}
                  className={`px-3 py-2.5 rounded-md text-sm font-medium border transition-colors ${
                    goal === g.value ? 'bg-blood-700 border-blood-700 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full px-4 py-3 rounded-md bg-blood-700 hover:bg-blood-600 disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? 'Chvilku…' : 'Založit účet'}
          </button>
        </form>

        <p className="text-center text-neutral-500 text-sm mt-6">
          Už máš účet? <Link to="/diary/login" className="text-blood-500 hover:text-blood-400">Přihlásit se</Link>
        </p>
        <p className="text-center text-neutral-600 text-xs mt-4">
          <Link to="/" className="hover:text-neutral-400">Zpět na úvod</Link>
        </p>
      </div>
    </div>
  )
}
