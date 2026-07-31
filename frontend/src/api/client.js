import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('bg_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
    config.headers['X-Auth-Token'] = token
  }
  return config
})

function isMujHost() {
  return window.location.hostname === 'muj.bloodandguts.cz' || window.location.hostname.startsWith('muj.')
}

// Cíl přihlašovací obrazovky při ztrátě/absenci session. Na muj.bloodandguts.cz je /login
// (výběr osoby ze seznamu) funkčně prázdný — role 'diary' je z /auth/people záměrně
// vyřazená a v izolované DB stejně nejsou žádní trainer/client uživatelé.
export function loginPath() {
  return isMujHost() ? '/diary/login' : '/login'
}

apiClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('bg_token')
      localStorage.removeItem('bg_user')
      window.location.href = loginPath()
    }
    return Promise.reject(err)
  }
)

export async function fetchPeople() {
  const { data } = await apiClient.get('/auth/people')
  return data
}

export async function demoLogin(userId) {
  const { data } = await apiClient.post('/auth/demo-login', { user_id: userId })
  localStorage.setItem('bg_token', data.access_token)
  localStorage.setItem('bg_user', JSON.stringify(data.user))
  return data.user
}

export function logout() {
  localStorage.removeItem('bg_token')
  localStorage.removeItem('bg_user')
  window.location.href = loginPath()
}

export function isAuthenticated() {
  return !!localStorage.getItem('bg_token')
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem('bg_user') || 'null') } catch { return null }
}

export function homePath() {
  const u = getUser()
  if (u?.role === 'trainer') return '/trainer/calendar'
  if (u?.role === 'diary') return '/diary'
  return '/client'
}

export async function diaryRegister({ email, display_name, goal, password }) {
  const { data } = await apiClient.post('/diary/register', { email, display_name, goal, password })
  localStorage.setItem('bg_token', data.access_token)
  localStorage.setItem('bg_user', JSON.stringify(data.user))
  return data.user
}

export async function diaryLogin({ email, password }) {
  const { data } = await apiClient.post('/diary/login', { email, password })
  localStorage.setItem('bg_token', data.access_token)
  localStorage.setItem('bg_user', JSON.stringify(data.user))
  return data.user
}

export async function diaryResetRequest(email) {
  await apiClient.post('/diary/reset-request', { email })
}

export async function diaryResetConfirm({ token, password }) {
  const { data } = await apiClient.post('/diary/reset-confirm', { token, password })
  localStorage.setItem('bg_token', data.access_token)
  localStorage.setItem('bg_user', JSON.stringify(data.user))
  return data.user
}
