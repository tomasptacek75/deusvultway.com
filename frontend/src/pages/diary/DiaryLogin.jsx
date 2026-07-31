import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Dumbbell, Eye, EyeOff } from 'lucide-react'
import { diaryLogin, homePath } from '../../api/client'

export default function DiaryLogin() {
  const [email, setEmail] = useState('')
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
      await diaryLogin({ email: email.trim(), password })
      navigate(homePath())
    } catch (err) {
      setError(err.response?.data?.detail || 'Přihlášení se nezdařilo.')
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
        <p className="text-center text-neutral-500 text-sm mb-8">Hlasový tréninkový deník s AI.</p>

        {error && <div className="text-blood-400 text-sm text-center mb-4">{error}</div>}

        {/* autocomplete atributy níže umožňují prohlížeči/OS nabídnout uložení hesla do
            správce (iCloud Keychain, Google Password Manager) a při příštím přihlášení ho
            odemknout přes Face ID/Touch ID/otisk — biometrie tedy funguje na úrovni OS, ne appky. */}
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">E-mail</label>
            <input
              type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-md bg-neutral-900 border border-neutral-800 focus:border-blood-600 outline-none"
              placeholder="ty@example.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm text-neutral-400">Heslo</label>
              <Link to="/diary/reset-request" className="text-xs text-neutral-500 hover:text-neutral-300">Zapomenuté heslo?</Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 pr-10 rounded-md bg-neutral-900 border border-neutral-800 focus:border-blood-600 outline-none"
                placeholder="Tvoje heslo"
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
            type="submit" disabled={loading}
            className="w-full px-4 py-3 rounded-md bg-blood-700 hover:bg-blood-600 disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? 'Chvilku…' : 'Přihlásit se'}
          </button>
        </form>

        <p className="text-center text-neutral-500 text-sm mt-6">
          Nemáš účet? <Link to="/diary/register" className="text-blood-500 hover:text-blood-400">Založit účet</Link>
        </p>
      </div>
    </div>
  )
}
