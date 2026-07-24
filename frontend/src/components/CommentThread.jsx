import { useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

// Vlákno komentářů vázané na konkrétní cvik nebo trénink (S3) — zpětná vazba k technice (T5).
export default function CommentThread({ comments, onSubmit, placeholder }) {
  const { t } = useLanguage()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    await onSubmit(body.trim())
    setBody('')
    setBusy(false)
  }

  return (
    <div className="mt-3 pt-3 border-t border-neutral-800">
      <div className="flex items-center gap-1.5 text-xs text-neutral-500 uppercase tracking-wide mb-2">
        <MessageSquare size={13} /> {t('Komentáře', 'Comments')}
      </div>
      {comments?.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {comments.map((c) => (
            <div key={c.id} className="text-xs bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2">
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <span className="font-medium text-blood-500">{c.author_name}</span>
                <span className="text-neutral-600">{c.created_at?.slice(0, 16).replace('T', ' ')}</span>
              </div>
              <div className="text-neutral-300">{c.body}</div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder ?? t('Napiš komentář…', 'Write a comment…')}
          className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-2 py-1.5 text-xs"
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="shrink-0 bg-neutral-800 hover:bg-blood-700 transition-colors rounded-md px-2.5 py-1.5 disabled:opacity-40"
        >
          <Send size={13} />
        </button>
      </form>
    </div>
  )
}
