import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { apiClient } from '../api/client'
import { useLanguage } from '../i18n/LanguageContext'

// Polling misto WebSocketů — Forpsi shared hosting nemá websocket server, 20s interval
// funkčně pokrývá S1/S2 (klient/trenér se dozví o novince v řádu vteřin až sekund).
const POLL_MS = 20000

export default function NotificationBell() {
  const { t } = useLanguage()
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function refresh() {
      apiClient.get('/notifications/unread-count').then((r) => setCount(r.data.count)).catch(() => {})
    }
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next) {
      const { data } = await apiClient.get('/notifications')
      setItems(data)
      if (count > 0) {
        await apiClient.post('/notifications/read-all')
        setCount(0)
      }
    }
  }

  function goTo(n) {
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative text-neutral-300 hover:text-white p-1.5" aria-label={t('Notifikace', 'Notifications')}>
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-blood-600 text-white text-[10px] leading-none rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl z-20">
          {items.length === 0 && <p className="text-neutral-500 text-sm p-4">{t('Zatím žádné notifikace.', 'No notifications yet.')}</p>}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => goTo(n)}
              className="block w-full text-left px-4 py-3 border-b border-neutral-800 last:border-0 hover:bg-neutral-800 transition-colors"
            >
              <div className="text-sm text-neutral-200">{n.body}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{n.created_at?.slice(0, 16).replace('T', ' ')}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
