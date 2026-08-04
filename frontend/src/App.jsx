import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import { isAuthenticated, homePath } from './api/client'

// Lazy-loaded per route: trenér/klient/deník appky se sdílí v jednom Vite buildu (viz
// _ftp_deploy_muj.py), takže bez code-splittingu stahoval každý návštěvník — i ten, co vidí
// jen Landing nebo jen Login — jeden ~525 kB JS chunk se vším pro všechny tři role. Suspense
// fallback níž je jen text, appka je i tak rychlá (Forpsi + malé chunky), netřeba spinner.
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const Overview = lazy(() => import('./pages/trainer/Overview'))
const TrainerDashboard = lazy(() => import('./pages/trainer/TrainerDashboard'))
const ClientDetail = lazy(() => import('./pages/trainer/ClientDetail'))
const Exercises = lazy(() => import('./pages/trainer/Exercises'))
const TrainerCalendar = lazy(() => import('./pages/trainer/TrainerCalendar'))
const Inquiries = lazy(() => import('./pages/trainer/Inquiries'))
const TrainingPlans = lazy(() => import('./pages/trainer/TrainingPlans'))
const Teams = lazy(() => import('./pages/trainer/Teams'))
const Equipment = lazy(() => import('./pages/trainer/Equipment'))
const Tiers = lazy(() => import('./pages/trainer/Tiers'))
const TrainerShop = lazy(() => import('./pages/trainer/Shop'))
const TrainerContentLibrary = lazy(() => import('./pages/trainer/ContentLibrary'))
const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'))
const ClientCalendar = lazy(() => import('./pages/client/ClientCalendar'))
const WorkoutDetail = lazy(() => import('./pages/client/WorkoutDetail'))
const Progress = lazy(() => import('./pages/client/Progress'))
const Nutrition = lazy(() => import('./pages/client/Nutrition'))
const History = lazy(() => import('./pages/client/History'))
const Messages = lazy(() => import('./pages/client/Messages'))
const Billing = lazy(() => import('./pages/client/Billing'))
const ClientContentLibrary = lazy(() => import('./pages/client/ContentLibrary'))
const MyGym = lazy(() => import('./pages/client/MyGym'))
const ExerciseLibrary = lazy(() => import('./pages/client/ExerciseLibrary'))
const AboutTrainer = lazy(() => import('./pages/client/AboutTrainer'))
const ClientShop = lazy(() => import('./pages/client/Shop'))
const DiaryRegister = lazy(() => import('./pages/diary/DiaryRegister'))
const DiaryLogin = lazy(() => import('./pages/diary/DiaryLogin'))
const DiaryResetRequest = lazy(() => import('./pages/diary/DiaryResetRequest'))
const DiaryResetConfirm = lazy(() => import('./pages/diary/DiaryResetConfirm'))
const DiaryHome = lazy(() => import('./pages/diary/DiaryHome'))
const DiaryRecord = lazy(() => import('./pages/diary/DiaryRecord'))
const DiaryManualEntry = lazy(() => import('./pages/diary/DiaryManualEntry'))
const DiaryHistory = lazy(() => import('./pages/diary/DiaryHistory'))
const DiaryNextWorkout = lazy(() => import('./pages/diary/DiaryNextWorkout'))
const DiaryGoal = lazy(() => import('./pages/diary/DiaryGoal'))

const trainerLinks = [
  // Přehled (Overview.jsx, dashboard s počty) je landing page po přihlášení (homePath() v
  // api/client.js) — dřív dosažitelný jen kliknutím na logo, teď má i vlastní odkaz v menu
  // na žádost uživatele 2026-08-03.
  { to: '/trainer', label: 'Přehled', labelEn: 'Overview', end: true },
  { to: '/trainer/clients', label: 'Klienti', labelEn: 'Clients', end: true },
  { to: '/trainer/plans', label: 'Plány', labelEn: 'Plans' },
  { to: '/trainer/exercises', label: 'Cviky', labelEn: 'Exercises' },
  // "Služby" = Tiers.jsx (cenové tiery + jednotlivé služby v nich) — dřív dosažitelné jen
  // odkazem z Klientů/Billing tabu, teď má vlastní položku v menu na žádost uživatele
  // 2026-08-03; odkaz "Spravovat tiery" na /trainer/clients proto odstraněn (redundantní).
  { to: '/trainer/tiers', label: 'Služby', labelEn: 'Services' },
  // "Kalendář" schovaný z menu (2026-08-03, prozatímně) — routa `/trainer/calendar`
  // zůstává funkční. "Vybavení" a "Týmy" schované dřív (2026-08-02 a 2026-08-03) ze
  // stejného důvodu. "Cviky" bylo krátce schované taky, ale vráceno zpět — je to jediné
  // místo, kde David nahrává/edituje videa cviků k Davidovu vlastnímu bodu 2 z feedbacku
  // (viz project_bloodandguts_david_feedback_implementation memory).
  // Nav label "O mně" (na žádost uživatele 2026-08-03) — stránka (ContentLibrary.jsx) dál
  // spravuje obojí, "O mně" i generickou "library" knihovnu (viz kind sloupec/odznáček na
  // sekcích), jen v menu se to teď volá podle toho, co David reálně používá nejvíc.
  { to: '/trainer/content', label: 'O mně', labelEn: 'About me' },
  { to: '/trainer/inquiries', label: 'Poptávky', labelEn: 'Inquiries' },
  // E-shop (merch — trička, kraťasy, doplňky) úplně na konci na žádost uživatele
  // 2026-08-03. Appka nemá platební bránu — objednávka je jen záznam, David ji ručně
  // posouvá přes stavy (viz project_bloodandguts_client_dashboard memory).
  { to: '/trainer/shop', label: 'E-shop', labelEn: 'Shop' },
]

const clientLinks = [
  { to: '/client', label: 'Přehled', labelEn: 'Overview', end: true },
  { to: '/client/calendar', label: 'Kalendář', labelEn: 'Calendar' },
  { to: '/client/progress', label: 'Progres', labelEn: 'Progress' },
  { to: '/client/nutrition', label: 'Výživa', labelEn: 'Nutrition' },
  { to: '/client/gym', label: 'Posilovna', labelEn: 'Gym' },
  { to: '/client/exercises', label: 'Cviky', labelEn: 'Exercises' },
  // "Historie" a obecná "Knihovna" schované z menu 2026-08-02 na žádost uživatele — routy
  // `/client/history` a `/client/library` zůstávají funkční, jen bez odkazu v navigaci.
  // Osobní rekordy z Historie se teď zobrazují na Progresu (viz Progress.jsx). "Knihovna
  // cviků" bylo krátce schované taky, ale vráceno zpět — je to skutečná realizace
  // Davidova bodu 2 z feedbacku (video ke každému cviku z katalogu), ne duplicita obecné
  // Knihovny (ta měla jen 1 placeholder záznam v "Video ukázky tréninku").
  { to: '/client/o-davidovi', label: 'O Davidovi', labelEn: 'About David' },
  { to: '/client/messages', label: 'Zprávy', labelEn: 'Messages' },
  { to: '/client/billing', label: 'Platby', labelEn: 'Billing' },
  { to: '/client/shop', label: 'E-shop', labelEn: 'Shop' },
]

const diaryLinks = [
  { to: '/diary', label: 'Přehled', labelEn: 'Přehled', end: true },
  { to: '/diary/record', label: 'Namluvit', labelEn: 'Namluvit' },
  { to: '/diary/history', label: 'Historie', labelEn: 'Historie' },
  { to: '/diary/next-workout', label: 'Návrh', labelEn: 'Návrh' },
  { to: '/diary/goal', label: 'Cíl', labelEn: 'Cíl' },
]

// muj.bloodandguts.cz servíruje stejný build jako bloodandguts.cz/test.bloodandguts.cz (viz
// _ftp_deploy_muj.py) — hostname branching rozhoduje, co se ukáže na "/".
const isMujHost = window.location.hostname === 'muj.bloodandguts.cz' || window.location.hostname.startsWith('muj.')

function App() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-neutral-500">Načítám…</div>}>
    <Routes>
      <Route path="/" element={
        isAuthenticated() ? <Navigate to={homePath()} replace />
        : isMujHost ? <Navigate to="/diary/login" replace />
        : <Landing />
      } />
      <Route path="/login" element={<Login />} />
      <Route path="/diary/login" element={<DiaryLogin />} />
      <Route path="/diary/register" element={<DiaryRegister />} />
      <Route path="/diary/reset-request" element={<DiaryResetRequest />} />
      <Route path="/diary/reset-confirm" element={<DiaryResetConfirm />} />

      <Route
        path="/diary"
        element={
          <ProtectedRoute role="diary">
            <AppShell links={diaryLinks} showLanguageToggle={false} showNotifications={false} />
          </ProtectedRoute>
        }
      >
        <Route index element={<DiaryHome />} />
        <Route path="record" element={<DiaryRecord />} />
        <Route path="manual" element={<DiaryManualEntry />} />
        <Route path="history" element={<DiaryHistory />} />
        <Route path="next-workout" element={<DiaryNextWorkout />} />
        <Route path="goal" element={<DiaryGoal />} />
      </Route>

      <Route
        path="/trainer"
        element={
          <ProtectedRoute role="trainer">
            <AppShell links={trainerLinks} />
          </ProtectedRoute>
        }
      >
        <Route index element={<Overview />} />
        <Route path="clients" element={<TrainerDashboard />} />
        <Route path="calendar" element={<TrainerCalendar />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="plans" element={<TrainingPlans />} />
        <Route path="teams" element={<Teams />} />
        <Route path="exercises" element={<Exercises />} />
        <Route path="equipment" element={<Equipment />} />
        <Route path="tiers" element={<Tiers />} />
        <Route path="content" element={<TrainerContentLibrary />} />
        <Route path="inquiries" element={<Inquiries />} />
        <Route path="shop" element={<TrainerShop />} />
      </Route>

      <Route
        path="/client"
        element={
          <ProtectedRoute role="client">
            <AppShell links={clientLinks} />
          </ProtectedRoute>
        }
      >
        <Route index element={<ClientDashboard />} />
        <Route path="calendar" element={<ClientCalendar />} />
        <Route path="workouts/:id" element={<WorkoutDetail />} />
        <Route path="history" element={<History />} />
        <Route path="progress" element={<Progress />} />
        <Route path="nutrition" element={<Nutrition />} />
        <Route path="gym" element={<MyGym />} />
        <Route path="exercises" element={<ExerciseLibrary />} />
        <Route path="library" element={<ClientContentLibrary />} />
        <Route path="o-davidovi" element={<AboutTrainer />} />
        <Route path="messages" element={<Messages />} />
        <Route path="billing" element={<Billing />} />
        <Route path="shop" element={<ClientShop />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}

export default App
