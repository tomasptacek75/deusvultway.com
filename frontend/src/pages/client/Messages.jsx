import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'

export default function Messages() {
  const { t } = useLanguage()
  const [trainerId, setTrainerId] = useState(null)
  const [trainerName, setTrainerName] = useState('')
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    apiClient.get('/auth/people').then((r) => {
      const trainer = r.data.find((p) => p.role === 'trainer')
      if (trainer) { setTrainerId(trainer.id); setTrainerName(trainer.display_name) }
    })
  }, [])

  function load() {
    if (!trainerId) return
    apiClient.get('/messages', { params: { with: trainerId } }).then((r) => setMessages(r.data))
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [trainerId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  async function submit(e) {
    e.preventDefault()
    if (!body.trim()) return
    await apiClient.post('/messages', { recipient_id: trainerId, body: body.trim() })
    setBody('')
    load()
  }

  return (
    <div>
      <h1 className="text-3xl mb-6 flex items-center gap-3">
        <MessageCircle className="text-blood-600" /> {t('Zprávy', 'Messages')}{trainerName ? ` ${t('s', 'with')} ${trainerName}` : ''}
      </h1>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 h-[60vh] flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_id === trainerId ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  m.sender_id === trainerId ? 'bg-neutral-800 text-neutral-200' : 'bg-blood-700 text-white'
                }`}
              >
                {m.body}
                <div className="text-[10px] opacity-60 mt-1">{m.created_at?.slice(0, 16).replace('T', ' ')}</div>
              </div>
            </div>
          ))}
          {messages.length === 0 && <p className="text-neutral-500 text-sm text-center mt-8">{t('Zatím žádné zprávy — napiš první.', 'No messages yet — write the first one.')}</p>}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={submit} className="flex gap-2 p-3 border-t border-neutral-800">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('Napiš zprávu…', 'Write a message…')}
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-4 py-2 text-sm font-medium flex items-center gap-1.5">
            <Send size={14} /> {t('Odeslat', 'Send')}
          </button>
        </form>
      </div>
    </div>
  )
}
