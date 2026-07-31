import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import { isAuthenticated, homePath } from './api/client'
import Landing from './pages/Landing'
import Login from './pages/Login'
import TrainerDashboard from './pages/trainer/TrainerDashboard'
import ClientDetail from './pages/trainer/ClientDetail'
import Exercises from './pages/trainer/Exercises'
import TrainerCalendar from './pages/trainer/TrainerCalendar'
import Inquiries from './pages/trainer/Inquiries'
import TrainingPlans from './pages/trainer/TrainingPlans'
import Teams from './pages/trainer/Teams'
import Equipment from './pages/trainer/Equipment'
import TrainerContentLibrary from './pages/trainer/ContentLibrary'
import ClientDashboard from './pages/client/ClientDashboard'
import ClientCalendar from './pages/client/ClientCalendar'
import WorkoutDetail from './pages/client/WorkoutDetail'
import Progress from './pages/client/Progress'
import Nutrition from './pages/client/Nutrition'
import History from './pages/client/History'
import Messages from './pages/client/Messages'
import Billing from './pages/client/Billing'
import ClientContentLibrary from './pages/client/ContentLibrary'
import DiaryRegister from './pages/diary/DiaryRegister'
import DiaryLogin from './pages/diary/DiaryLogin'
import DiaryResetRequest from './pages/diary/DiaryResetRequest'
import DiaryResetConfirm from './pages/diary/DiaryResetConfirm'
import DiaryHome from './pages/diary/DiaryHome'
import DiaryRecord from './pages/diary/DiaryRecord'
import DiaryManualEntry from './pages/diary/DiaryManualEntry'
import DiaryHistory from './pages/diary/DiaryHistory'
import DiaryNextWorkout from './pages/diary/DiaryNextWorkout'
import DiaryGoal from './pages/diary/DiaryGoal'

const trainerLinks = [
  { to: '/trainer/calendar', label: 'Kalendář', labelEn: 'Calendar' },
  { to: '/trainer', label: 'Klienti', labelEn: 'Clients', end: true },
  { to: '/trainer/plans', label: 'Plány', labelEn: 'Plans' },
  { to: '/trainer/teams', label: 'Týmy', labelEn: 'Teams' },
  { to: '/trainer/exercises', label: 'Cviky', labelEn: 'Exercises' },
  { to: '/trainer/equipment', label: 'Vybavení', labelEn: 'Equipment' },
  { to: '/trainer/content', label: 'Knihovna', labelEn: 'Library' },
  { to: '/trainer/inquiries', label: 'Poptávky', labelEn: 'Inquiries' },
]

const clientLinks = [
  { to: '/client', label: 'Přehled', labelEn: 'Overview', end: true },
  { to: '/client/calendar', label: 'Kalendář', labelEn: 'Calendar' },
  { to: '/client/history', label: 'Historie', labelEn: 'History' },
  { to: '/client/progress', label: 'Progres', labelEn: 'Progress' },
  { to: '/client/nutrition', label: 'Výživa', labelEn: 'Nutrition' },
  { to: '/client/library', label: 'Knihovna', labelEn: 'Library' },
  { to: '/client/messages', label: 'Zprávy', labelEn: 'Messages' },
  { to: '/client/billing', label: 'Platby', labelEn: 'Billing' },
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
            <AppShell links={diaryLinks} />
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
        <Route index element={<TrainerDashboard />} />
        <Route path="calendar" element={<TrainerCalendar />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="plans" element={<TrainingPlans />} />
        <Route path="teams" element={<Teams />} />
        <Route path="exercises" element={<Exercises />} />
        <Route path="equipment" element={<Equipment />} />
        <Route path="content" element={<TrainerContentLibrary />} />
        <Route path="inquiries" element={<Inquiries />} />
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
        <Route path="library" element={<ClientContentLibrary />} />
        <Route path="messages" element={<Messages />} />
        <Route path="billing" element={<Billing />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
