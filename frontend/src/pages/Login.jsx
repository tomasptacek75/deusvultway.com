import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'
import { fetchPeople, demoLogin, homePath } from '../api/client'
import { useLanguage } from '../i18n/LanguageContext'
import LanguageToggle from '../components/LanguageToggle'

export default function Login() {
  const { t } = useLanguage()
  const [people, setPeople] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchPeople().then(setPeople).catch(() => setError(t('Nepodařilo se načíst seznam uživatelů.', 'Failed to load the list of users.')))
  }, [t])

  async function handleLogin(userId) {
    setError('')
    try {
      await demoLogin(userId)
      navigate(homePath())
    } catch {
      setError(t('Přihlášení se nezdařilo.', 'Login failed.'))
    }
  }

  const trainers = people?.filter((p) => p.role === 'trainer') ?? []
  const clients = people?.filter((p) => p.role === 'client') ?? []

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Link to="/" className="flex items-center gap-2 font-display text-xl tracking-widest hover:text-blood-400 transition-colors">
            <Dumbbell className="text-blood-600" size={26} />
            BLOOD<span className="text-blood-600">&amp;</span>GUTS
          </Link>
          <LanguageToggle />
        </div>
        <p className="text-center text-neutral-500 text-sm mb-8">
          {t('POC režim — přihlášení bez hesla. Vyber, kdo jsi.', 'POC mode — password-free login. Pick who you are.')}
        </p>

        {error && <div className="text-blood-400 text-sm text-center mb-4">{error}</div>}

        <div className="mb-8">
          <h2 className="text-sm uppercase tracking-widest text-neutral-500 mb-3">{t('Trenér', 'Coach')}</h2>
          <div className="space-y-2">
            {trainers.map((p) => (
              <button
                key={p.id}
                onClick={() => handleLogin(p.id)}
                className="w-full text-left px-4 py-3 rounded-md bg-neutral-900 border border-neutral-800 hover:border-blood-600 transition-colors"
              >
                {p.display_name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm uppercase tracking-widest text-neutral-500 mb-3">{t('Klient', 'Client')}</h2>
          <div className="space-y-2">
            {clients.map((p) => (
              <button
                key={p.id}
                onClick={() => handleLogin(p.id)}
                className="w-full text-left px-4 py-3 rounded-md bg-neutral-900 border border-neutral-800 hover:border-blood-600 transition-colors"
              >
                {p.display_name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
