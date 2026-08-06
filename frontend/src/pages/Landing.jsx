import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Dumbbell, Flame, Target, LineChart, Send, CheckCircle2, Mail, Phone, Crown } from 'lucide-react'
import { apiClient } from '../api/client'
import { useLanguage } from '../i18n/LanguageContext'
import LanguageToggle from '../components/LanguageToggle'
import Wordmark from '../components/Wordmark'

const TRAINER_EMAIL = 'tyylle@seznam.cz'
const TRAINER_PHONE = '+420 736 690 419'

const TIERS = [
  {
    name: 'Profi', nameEn: 'Pro',
    price: '1 500 Kč / měsíc', priceEn: '1,500 CZK / month',
    features: [
      ['Individuální tréninkový plán', 'Individual training plan'],
      ['Video ukázky cviků s komentářem', 'Exercise videos with commentary'],
      ['Týdenní úpravy dle progresu', 'Weekly adjustments based on progress'],
      ['Výživové doporučení', 'Nutrition guidance'],
      ['Sledování cíle a pokroku', 'Goal and progress tracking'],
    ],
  },
  {
    name: 'Elite', nameEn: 'Elite',
    price: '3 000 Kč / měsíc', priceEn: '3,000 CZK / month',
    highlighted: true,
    vip: true,
    tagline: 'Uzavřený VIP klub — místo, kde se David věnuje jen hrstce lidí naplno.',
    taglineEn: 'A closed VIP club — where David gives his full focus to just a handful of people.',
    features: [
      ['Vše z Profi', 'Everything in Pro'],
      ['Přímá zpětná vazba od Davida', 'Direct feedback from David'],
      ['Prioritní úpravy plánu', 'Priority plan adjustments'],
      ['Konzultace 1x měsíčně', 'Monthly consultation'],
      ['Omezeno na 10 klientů', 'Limited to 10 clients'],
    ],
  },
]

export default function Landing() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-neutral-950/95 border-b border-neutral-800 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="text-blood-600" size={26} />
            <Wordmark className="h-7" />
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link
              to="/login"
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              {t('Přihlásit se', 'Log in')}
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-4 pt-2 pb-24 text-center">
        <h1 className="text-5xl md:text-6xl font-bold leading-tight">
          {t('Trénuj jako by šlo', 'Train like it')} <span className="text-blood-600">{t('o všechno', 'means everything')}</span>
        </h1>
        <p className="mt-6 text-lg text-neutral-400 max-w-2xl mx-auto">
          {t(
            'Individualizovaný silový tréninkový plán od Davida — cviky, série, váhy a strava přizpůsobené přesně tobě. Žádné univerzální tabulky z internetu.',
            'An individualized strength training plan from David — exercises, sets, weights and nutrition tailored exactly to you. No generic spreadsheets from the internet.'
          )}
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <a
            href="#plany"
            className="bg-blood-700 hover:bg-blood-600 transition-colors px-6 py-3 rounded-md font-semibold"
          >
            {t('Zobrazit plány', 'View plans')}
          </a>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        <Feature
          icon={<Flame className="text-blood-600" />}
          title={t('Plán na míru', 'Plan tailored to you')}
          text={t(
            'Žádné šablony — David sestaví trénink podle tvé úrovně, cílů a možností.',
            'No templates — David builds your training around your level, goals and constraints.'
          )}
        />
        <Feature
          icon={<Target className="text-blood-600" />}
          title={t('Video ukázky', 'Video demos')}
          text={t(
            'Ke každému cviku video přímo od Davida s komentářem, na co si dát pozor.',
            "A video from David for every exercise, with commentary on what to watch out for."
          )}
        />
        <Feature
          icon={<LineChart className="text-blood-600" />}
          title={t('Sledování pokroku', 'Progress tracking')}
          text={t(
            'Váha, míry i zvedané váhy na jednom místě — vidíš přesně, jak postupuješ.',
            'Bodyweight, measurements and lifted weights in one place — see exactly how you progress.'
          )}
        />
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <img
          src="/david.jpg"
          alt="David — trenér Deus Vult Way"
          className="rounded-xl border border-neutral-800 w-full max-w-sm mx-auto md:mx-0"
        />
        <div>
          <h2 className="text-3xl mb-4">{t('O trenérovi', 'About the coach')}</h2>
          <p className="text-neutral-400 mb-6">
            {t(
              'David je silový trenér, který ti sestaví tréninkový plán přesně na míru — žádné kopírované tabulky. Ke každému cviku se dozvíš, jak přesně na to a na co si dát pozor.',
              'David is a strength coach who builds your training plan completely custom — no copy-pasted spreadsheets. For every exercise you’ll learn exactly how to do it and what to watch out for.'
            )}
          </p>
          <div className="space-y-2 text-sm">
            <a href={`mailto:${TRAINER_EMAIL}`} className="flex items-center gap-2 text-neutral-300 hover:text-blood-500 transition-colors w-fit">
              <Mail size={16} className="text-blood-600" /> {TRAINER_EMAIL}
            </a>
            <a href={`tel:${TRAINER_PHONE.replace(/\s/g, '')}`} className="flex items-center gap-2 text-neutral-300 hover:text-blood-500 transition-colors w-fit">
              <Phone size={16} className="text-blood-600" /> {TRAINER_PHONE}
            </a>
          </div>
        </div>
      </section>

      <section id="plany" className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl text-center mb-2">{t('Předplatné', 'Subscriptions')}</h2>
        <p className="text-center text-neutral-500 mb-12 text-sm">
          {t('Vyber si úroveň, která ti sedne.', 'Pick the tier that suits you.')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-xl border p-8 flex flex-col ${
                tier.vip
                  ? 'border-amber-500 bg-neutral-900 md:-translate-y-2 shadow-xl shadow-amber-900/20'
                  : 'border-neutral-800 bg-neutral-900/50'
              }`}
            >
              {tier.vip && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-amber-500 text-neutral-950 text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full">
                  <Crown size={12} /> {t('VIP klub', 'VIP club')}
                </span>
              )}
              <h3 className={`text-2xl mb-1 ${tier.vip ? 'text-amber-400' : ''}`}>{t(tier.name, tier.nameEn)}</h3>
              <div className="text-3xl font-bold mb-1">{t(tier.price, tier.priceEn)}</div>
              {tier.tagline && (
                <p className="text-xs text-amber-400/80 mb-6">{t(tier.tagline, tier.taglineEn)}</p>
              )}
              <ul className={`space-y-3 mb-8 flex-1 ${tier.tagline ? '' : 'mt-5'}`}>
                {tier.features.map(([cs, en]) => (
                  <li key={cs} className="text-sm text-neutral-300 flex gap-2">
                    <span className={tier.vip ? 'text-amber-500' : 'text-blood-600'}>✓</span> {t(cs, en)}
                  </li>
                ))}
              </ul>
              <a
                href="#kontakt"
                className={`text-center py-2.5 rounded-md font-semibold transition-colors ${
                  tier.vip
                    ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                    : tier.highlighted
                    ? 'bg-blood-700 hover:bg-blood-600'
                    : 'bg-neutral-800 hover:bg-neutral-700'
                }`}
              >
                {t('Mám zájem', "I'm interested")}
              </a>
            </div>
          ))}
        </div>
      </section>

      <section id="kontakt" className="max-w-xl mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl mb-4">{t('Chceš začít?', 'Ready to start?')}</h2>
        <p className="text-neutral-400 mb-8">
          {t('Napiš Davidovi pár slov o sobě a domluvte si úvodní konzultaci.', 'Send David a few words about yourself and set up an initial consultation.')}
        </p>
        <ContactForm />
      </section>

      <footer className="border-t border-neutral-800 py-8 text-center text-xs text-neutral-600">
        © {new Date().getFullYear()} Deus Vult Way — David. {t('Web zatím ve vývoji (POC), neveřejné.', 'Site still in development (POC), not public yet.')}
      </footer>
    </div>
  )
}

function Feature({ icon, title, text }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <h3 className="text-lg mb-2">{title}</h3>
      <p className="text-sm text-neutral-400">{text}</p>
    </div>
  )
}

function ContactForm() {
  const { t } = useLanguage()
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', website: '' })
  const [status, setStatus] = useState('idle') // idle | sending | sent | error

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('sending')
    try {
      await apiClient.post('/inquiries', form)
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-lg border border-blood-700 bg-neutral-900 p-8 flex flex-col items-center gap-3">
        <CheckCircle2 className="text-blood-500" size={32} />
        <p className="text-neutral-200 font-medium">{t('Díky, zpráva je odeslaná.', 'Thanks, your message has been sent.')}</p>
        <p className="text-sm text-neutral-500">{t('David se ti brzy ozve.', "David will get back to you soon.")}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-left space-y-3">
      {/* Honeypot — skryté pole, lidský návštěvník ho nevidí a nevyplní */}
      <input
        type="text"
        value={form.website}
        onChange={(e) => setForm({ ...form, website: e.target.value })}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />
      <input
        required
        placeholder={t('Jméno', 'Name')}
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2.5 text-sm"
      />
      <input
        required
        type="email"
        placeholder={t('E-mail', 'Email')}
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2.5 text-sm"
      />
      <input
        type="tel"
        placeholder={t('Telefon (nepovinné)', 'Phone (optional)')}
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2.5 text-sm"
      />
      <textarea
        required
        placeholder={t('O sobě a co od tréninku očekáváš…', 'About yourself and what you expect from training…')}
        rows={4}
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2.5 text-sm"
      />
      {status === 'error' && (
        <p className="text-sm text-blood-400">{t('Odeslání se nepovedlo, zkus to prosím znovu.', 'Sending failed, please try again.')}</p>
      )}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full flex items-center justify-center gap-2 bg-blood-700 hover:bg-blood-600 disabled:opacity-60 transition-colors px-6 py-3 rounded-md font-semibold"
      >
        <Send size={16} /> {status === 'sending' ? t('Odesílám…', 'Sending…') : t('Odeslat zprávu', 'Send message')}
      </button>
    </form>
  )
}
