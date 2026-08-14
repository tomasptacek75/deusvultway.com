import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, CheckCircle2, Mail, Phone } from 'lucide-react'
import { apiClient } from '../api/client'
import { useLanguage } from '../i18n/LanguageContext'
import LanguageToggle from '../components/LanguageToggle'
import Wordmark from '../components/Wordmark'

const TRAINER_EMAIL = 'tyylle@seznam.cz'
const TRAINER_PHONE = '+420 736 690 419'

// Černobílá retro sazba (vintage plakáty na siláky/muscle-mag reklamy, viz Wordmark.jsx pro
// pozadí hand-cut písma) — jediná stránka v appce, která používá font-retro/font-retroserif
// (Anton/PT Serif, viz index.css) a jede čistě mono, žádná blood-600 červená. Zbytek appky
// (AppShell, portál) zůstává v původním schématu, tohle je jen veřejná marketingová stránka.
const TIERS = [
  {
    name: 'Profi', nameEn: 'Pro',
    price: '1 500 Kč', priceEn: '1,500 CZK',
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
    price: '3 000 Kč', priceEn: '3,000 CZK',
    elite: true,
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
  const actionVideoRef = useRef(null)

  // autoPlay JSX prop na <video> nespolehlivě spouští přehrávání samo (běžná React kvirk —
  // atribut nemusí být na DOM uzlu přítomný přesně v okamžiku připojení do stránky, kdy
  // prohlížeč autoplay vyhodnocuje) — .play() voláno ručně po mountu je spolehlivější.
  useEffect(() => {
    actionVideoRef.current?.play().catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-white text-ink-900 font-retroserif pt-[env(safe-area-inset-top)]">
      <div className="max-w-5xl mx-auto sm:p-3">
        <div className="border-2 border-ink-900 sm:border-[3px]">

          <header className="flex items-center justify-between gap-2 border-b-2 border-ink-900 sm:border-b-[3px] px-4 sm:px-6 py-3 sm:py-4">
            <Link to="/landing" className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
              <Wordmark className="h-5 sm:h-8" mono />
            </Link>
            <div className="flex items-center gap-3 sm:gap-4 shrink-0 whitespace-nowrap">
              <LanguageToggle />
              <Link to="/login" className="font-retro text-[.7rem] sm:text-xs tracking-[.1em] uppercase border-b-2 border-ink-900 pb-0.5">
                {t('Přihlásit se', 'Log in')}
              </Link>
            </div>
          </header>

          {/* ---------- hero ---------- */}
          <section className="grid grid-cols-1 md:grid-cols-2 bg-ink-900 text-white">
            <div className="flex flex-col justify-center px-5 sm:px-8 py-10 md:py-12 order-2 md:order-1">
              <h1 className="font-retro uppercase !leading-[1.5] text-4xl sm:text-5xl [text-wrap:balance] mb-5">
                {t('Trénuj, jako by', 'Train like it')}<br />
                {t('šlo ', 'means ')}
                <span className="[-webkit-text-stroke:1.5px_white] [text-shadow:3px_3px_0_rgba(255,255,255,.22)]">
                  {t('o všechno', 'everything')}
                </span>
              </h1>
              <p className="max-w-md text-white/80 mb-7">
                {t(
                  'Individualizovaný silový tréninkový plán od Davida — cviky, série, váhy a strava přizpůsobené přesně tobě. Žádné univerzální tabulky z internetu.',
                  'An individualized strength training plan from David — exercises, sets, weights and nutrition tailored exactly to you. No generic spreadsheets from the internet.'
                )}
              </p>
              <a
                href="#cenik"
                className="self-start font-retro text-sm tracking-[.14em] uppercase bg-white text-ink-900 border-2 border-white px-7 py-3 hover:bg-ink-900 hover:text-white transition-colors"
              >
                {t('Zobrazit plány', 'View plans')}
              </a>
            </div>

            <div className="relative min-h-[280px] sm:min-h-[380px] order-1 md:order-2 bg-black">
              <img
                src="/david-retro.jpg"
                alt={t('David, silový trenér Deus Vult Way', 'David, strength coach at Deus Vult Way')}
                className="absolute inset-0 w-full h-full object-cover opacity-90"
                style={{ objectPosition: '50% 15%' }}
              />
              <blockquote className="absolute left-4 right-4 bottom-4 m-0 bg-black/75 border-l-[3px] border-white px-4 py-3.5 font-retroserif italic text-sm leading-snug">
                {t(
                  '„Necvičím lidi, co to nemyslí vážně. Kdo se mnou začne, jde do toho naplno — nebo vůbec.“',
                  '“I don’t train people who don’t mean it. If you start with me, you go all in — or not at all.”'
                )}
              </blockquote>
            </div>
          </section>

          {/* ---------- akční video ---------- */}
          <section className="relative border-b-2 border-ink-900 sm:border-b-[3px] h-40 sm:h-64 md:h-80 lg:h-[28rem] overflow-hidden bg-black">
            <video
              ref={actionVideoRef}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: '50% 40%' }}
              src="/david-action.mp4"
              poster="/david-action.jpg"
              autoPlay
              loop
              muted
              playsInline
              aria-label={t('David v posilovně při tréninku nohou', 'David training legs in the gym')}
            />
            <p className="absolute bottom-2 right-3 font-retro text-[.6rem] tracking-[.2em] uppercase text-white/70">
              {t('Trénink v akci', 'Training in action')}
            </p>
          </section>

          {/* ---------- co dostaneš ---------- */}
          <section className="border-b-2 border-ink-900 sm:border-b-[3px] px-5 sm:px-8 py-9 sm:py-11">
            <Kicker>{t('Co dostaneš', 'What you get')}</Kicker>
            <div className="grid grid-cols-1 sm:grid-cols-3 border-t border-ink-300">
              <Feature
                title={t('Plán na míru', 'Plan tailored to you')}
                text={t(
                  'Žádné šablony — David sestaví trénink podle tvé úrovně, cílů a možností.',
                  'No templates — David builds your training around your level, goals and constraints.'
                )}
              />
              <Feature
                title={t('Video ukázky', 'Video demos')}
                text={t(
                  'Ke každému cviku video přímo od Davida s komentářem, na co si dát pozor.',
                  'A video from David for every exercise, with commentary on what to watch out for.'
                )}
              />
              <Feature
                last
                title={t('Sledování pokroku', 'Progress tracking')}
                text={t(
                  'Váha, míry i zvedané váhy na jednom místě — vidíš přesně, jak postupuješ.',
                  'Bodyweight, measurements and lifted weights in one place — see exactly how you progress.'
                )}
              />
            </div>
          </section>

          {/* ---------- o trenérovi ---------- */}
          <section className="border-b-2 border-ink-900 sm:border-b-[3px] px-5 sm:px-8 py-9 sm:py-11">
            <Kicker>{t('O trenérovi', 'About the coach')}</Kicker>
            <h2 className="font-retro text-2xl uppercase mb-1">David</h2>
            <p className="font-retro text-[.62rem] tracking-[.2em] uppercase text-ink-500 mb-5">
              {t('Silový trenér · 15+ let zkušeností', 'Strength coach · 15+ years of experience')}
            </p>
            <p className="max-w-[42em] first-letter:font-retro first-letter:text-5xl first-letter:leading-[.75] first-letter:float-left first-letter:pr-2 first-letter:pt-1">
              {t(
                'David je silový trenér, který ti sestaví tréninkový plán přesně na míru — žádné kopírované tabulky. Ke každému cviku se dozvíš, jak přesně na to a na co si dát pozor.',
                'David is a strength coach who builds your training plan completely custom — no copy-pasted spreadsheets. For every exercise you’ll learn exactly how to do it and what to watch out for.'
              )}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-5 font-retro text-xs tracking-[.06em]">
              <a href={`mailto:${TRAINER_EMAIL}`} className="flex items-center gap-1.5 border-b border-ink-300 hover:border-ink-900 w-fit pb-0.5">
                <Mail size={13} /> {TRAINER_EMAIL}
              </a>
              <a href={`tel:${TRAINER_PHONE.replace(/\s/g, '')}`} className="flex items-center gap-1.5 border-b border-ink-300 hover:border-ink-900 w-fit pb-0.5">
                <Phone size={13} /> {TRAINER_PHONE}
              </a>
            </div>
          </section>

          {/* ---------- ceník ---------- */}
          <section id="cenik" className="border-b-2 border-ink-900 sm:border-b-[3px] px-5 sm:px-8 py-9 sm:py-11">
            <Kicker>{t('Ceník', 'Prices')}</Kicker>
            <h2 className="font-retro text-2xl sm:text-3xl uppercase [text-wrap:balance] mb-7">
              {t('Vyber si úroveň, která ti sedne', 'Pick the tier that suits you')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              {TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`relative border-2 sm:border-[3px] p-6 sm:p-7 ${
                    tier.elite ? 'bg-ink-900 text-white border-ink-900' : 'border-ink-900'
                  }`}
                >
                  <span
                    className={`absolute -top-3 left-6 font-retro text-[.6rem] tracking-[.18em] uppercase px-2.5 py-1 border ${
                      tier.elite ? 'bg-ink-900 text-white border-white' : 'bg-white text-ink-900 border-ink-900'
                    }`}
                  >
                    {t(tier.name, tier.nameEn)}
                  </span>
                  <h3 className="font-retro text-2xl uppercase mt-2 mb-1">{t(tier.name, tier.nameEn)}</h3>
                  <p className="font-retro text-lg mb-4">
                    {t(tier.price, tier.priceEn)}{' '}
                    <span className={`text-[.68rem] tracking-[.1em] ${tier.elite ? 'text-white/65' : 'text-ink-500'}`}>
                      / {t('měsíc', 'month')}
                    </span>
                  </p>
                  <ul className="text-sm">
                    {tier.features.map(([cs, en], i) => (
                      <li
                        key={cs}
                        className={`flex gap-2 py-1.5 ${i > 0 ? (tier.elite ? 'border-t border-white/20' : 'border-t border-ink-200') : ''}`}
                      >
                        <span className="text-[.7em] opacity-70 mt-[.35em]">★</span> {t(cs, en)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* ---------- kontakt ---------- */}
          <section id="kontakt" className="px-5 sm:px-8 py-9 sm:py-11 text-center">
            <Kicker center>{t('Kontakt', 'Contact')}</Kicker>
            <h2 className="font-retro text-2xl sm:text-3xl uppercase mb-3">{t('Chceš začít?', 'Ready to start?')}</h2>
            <p className="text-ink-500 max-w-md mx-auto mb-7">
              {t('Napiš Davidovi pár slov o sobě a domluvte si úvodní konzultaci.', 'Send David a few words about yourself and set up an initial consultation.')}
            </p>
            <ContactForm />
          </section>

          <footer className="border-t-2 border-ink-900 sm:border-t-[3px] px-5 py-5 text-center font-retro text-[.6rem] tracking-[.16em] uppercase text-ink-400">
            {t('Deus Vult Way — David trénuje od MMVIII', 'Deus Vult Way — David coaching since MMVIII')} · {t('Web zatím ve vývoji (POC), neveřejné', 'Site still in development (POC), not public yet')}
          </footer>
        </div>
      </div>
    </div>
  )
}

function Kicker({ children, center }) {
  return (
    <p className={`font-retro text-[.66rem] tracking-[.28em] uppercase text-ink-500 flex items-center gap-3 mb-4 ${center ? 'justify-center' : ''}`}>
      {children}
      <span className="flex-1 h-px bg-ink-300 max-w-[8rem]" />
    </p>
  )
}

function Feature({ title, text, last }) {
  return (
    <div className={`py-6 sm:py-0 sm:px-6 first:pt-0 first:sm:pl-0 border-t sm:border-t-0 first:border-t-0 border-ink-200 ${last ? '' : 'sm:border-r border-ink-200'}`}>
      <div className="text-ink-400 mb-2.5">★</div>
      <h3 className="font-retroserif font-bold text-lg mb-1.5">{title}</h3>
      <p className="text-sm text-ink-500">{text}</p>
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
      <div className="border-2 border-ink-900 p-8 flex flex-col items-center gap-3 max-w-md mx-auto">
        <CheckCircle2 size={32} />
        <p className="font-medium">{t('Díky, zpráva je odeslaná.', 'Thanks, your message has been sent.')}</p>
        <p className="text-sm text-ink-500">{t('David se ti brzy ozve.', "David will get back to you soon.")}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border-2 border-ink-900 p-6 text-left space-y-3 max-w-md mx-auto">
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
        className="w-full border border-ink-300 focus:border-ink-900 outline-none px-3 py-2.5 text-sm"
      />
      <input
        required
        type="email"
        placeholder={t('E-mail', 'Email')}
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="w-full border border-ink-300 focus:border-ink-900 outline-none px-3 py-2.5 text-sm"
      />
      <input
        type="tel"
        placeholder={t('Telefon (nepovinné)', 'Phone (optional)')}
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        className="w-full border border-ink-300 focus:border-ink-900 outline-none px-3 py-2.5 text-sm"
      />
      <textarea
        required
        placeholder={t('O sobě a co od tréninku očekáváš…', 'About yourself and what you expect from training…')}
        rows={4}
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        className="w-full border border-ink-300 focus:border-ink-900 outline-none px-3 py-2.5 text-sm"
      />
      {status === 'error' && (
        <p className="text-sm text-red-700">{t('Odeslání se nepovedlo, zkus to prosím znovu.', 'Sending failed, please try again.')}</p>
      )}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full flex items-center justify-center gap-2 font-retro text-sm tracking-[.1em] uppercase bg-ink-900 text-white hover:bg-ink-700 disabled:opacity-60 transition-colors px-6 py-3"
      >
        <Send size={16} /> {status === 'sending' ? t('Odesílám…', 'Sending…') : t('Odeslat zprávu', 'Send message')}
      </button>
    </form>
  )
}
