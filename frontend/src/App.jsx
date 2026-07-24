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
import ClientDashboard from './pages/client/ClientDashboard'
import ClientCalendar from './pages/client/ClientCalendar'
import WorkoutDetail from './pages/client/WorkoutDetail'
import Progress from './pages/client/Progress'
import Nutrition from './pages/client/Nutrition'
import History from './pages/client/History'
import Messages from './pages/client/Messages'
import Billing from './pages/client/Billing'

const trainerLinks = [
  { to: '/trainer/calendar', label: 'Kalendář', labelEn: 'Calendar' },
  { to: '/trainer', label: 'Klienti', labelEn: 'Clients', end: true },
  { to: '/trainer/plans', label: 'Plány', labelEn: 'Plans' },
  { to: '/trainer/teams', label: 'Týmy', labelEn: 'Teams' },
  { to: '/trainer/exercises', label: 'Cviky', labelEn: 'Exercises' },
  { to: '/trainer/inquiries', label: 'Poptávky', labelEn: 'Inquiries' },
]

const clientLinks = [
  { to: '/client', label: 'Přehled', labelEn: 'Overview', end: true },
  { to: '/client/calendar', label: 'Kalendář', labelEn: 'Calendar' },
  { to: '/client/history', label: 'Historie', labelEn: 'History' },
  { to: '/client/progress', label: 'Progres', labelEn: 'Progress' },
  { to: '/client/nutrition', label: 'Výživa', labelEn: 'Nutrition' },
  { to: '/client/messages', label: 'Zprávy', labelEn: 'Messages' },
  { to: '/client/billing', label: 'Platby', labelEn: 'Billing' },
]

function App() {
  return (
    <Routes>
      <Route path="/" element={isAuthenticated() ? <Navigate to={homePath()} replace /> : <Landing />} />
      <Route path="/login" element={<Login />} />

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
        <Route path="messages" element={<Messages />} />
        <Route path="billing" element={<Billing />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
