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

apiClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('bg_token')
      localStorage.removeItem('bg_user')
      window.location.href = '/login'
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
  window.location.href = '/login'
}

export function isAuthenticated() {
  return !!localStorage.getItem('bg_token')
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem('bg_user') || 'null') } catch { return null }
}

export function homePath() {
  const u = getUser()
  return u?.role === 'trainer' ? '/trainer/calendar' : '/client'
}
