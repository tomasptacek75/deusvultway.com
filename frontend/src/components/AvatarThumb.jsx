import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import { apiClient } from '../api/client'

// Profilová fotka klienta — autentizovaný endpoint (ne veřejný /public), takže obyčejný
// <img src> nejde (JWT je jen v Authorization hlavičce). Stáhne se jako blob; když klient
// fotku nemá (404), zobrazí se placeholder ikona místo opakovaných neúspěšných požadavků.
export default function AvatarThumb({ userId, hasAvatar, size = 32, className = '', style: extraStyle }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(!hasAvatar)

  useEffect(() => {
    if (!hasAvatar) { setFailed(true); return }
    let objectUrl
    let cancelled = false
    apiClient.get(`/users/${userId}/avatar`, { responseType: 'blob' })
      .then((r) => { if (!cancelled) { objectUrl = URL.createObjectURL(r.data); setUrl(objectUrl) } })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [userId, hasAvatar])

  const style = { width: size, height: size, ...extraStyle }

  if (failed || !url) {
    return (
      <div style={style} className={`rounded-full bg-neutral-800 flex items-center justify-center text-neutral-500 shrink-0 ${className}`}>
        <User size={Math.round(size * 0.55)} />
      </div>
    )
  }
  return <img src={url} style={style} className={`rounded-full object-cover shrink-0 ${className}`} alt="" />
}
