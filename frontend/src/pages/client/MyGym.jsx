import { useEffect, useState } from 'react'
import { Dumbbell, Check } from 'lucide-react'
import { apiClient, getUser } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'
import CommentThread from '../../components/CommentThread'

export default function MyGym() {
  const { t } = useLanguage()
  const clientId = getUser().id
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [comments, setComments] = useState([])
  const [saved, setSaved] = useState(false)

  function load() {
    apiClient.get(`/clients/${clientId}/gym-link`).then((r) => {
      if (r.data) { setName(r.data.name); setUrl(r.data.url || '') }
    })
    apiClient.get(`/clients/${clientId}/gym-link/comments`).then((r) => setComments(r.data))
  }
  useEffect(load, [clientId])

  async function save(e) {
    e.preventDefault()
    setSaved(false)
    await apiClient.put(`/clients/${clientId}/gym-link`, { name, url: url || null })
    setSaved(true)
  }

  async function postComment(body) {
    await apiClient.post(`/clients/${clientId}/gym-link/comments`, { body })
    apiClient.get(`/clients/${clientId}/gym-link/comments`).then((r) => setComments(r.data))
  }

  return (
    <div>
      <h1 className="text-3xl mb-8 flex items-center gap-3">
        <Dumbbell className="text-blood-600" /> {t('Moje posilovna', 'My gym')}
      </h1>
      <p className="text-neutral-400 text-sm mb-6">
        {t('Dej Davidovi vědět, kde trénuješ — pošli mu název a odkaz na tvoji posilovnu, ať ti může doporučit konkrétní stroje.',
           "Let David know where you train — send him the name and a link to your gym so he can recommend specific machines.")}
      </p>
      <form onSubmit={save} className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 space-y-4 max-w-lg">
        <div>
          <label className="block text-sm text-neutral-400 mb-1">{t('Název posilovny', 'Gym name')}</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full px-3 py-2 rounded-md bg-neutral-950 border border-neutral-800"
          />
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">{t('Odkaz (web/mapy)', 'Link (website/maps)')}</label>
          <input
            type="url" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…" className="w-full px-3 py-2 rounded-md bg-neutral-950 border border-neutral-800"
          />
        </div>
        <button type="submit" className="px-4 py-2.5 rounded-md bg-blood-700 hover:bg-blood-600 font-medium flex items-center gap-2">
          <Check size={16} /> {t('Uložit', 'Save')}
        </button>
        {saved && <span className="text-sm text-neutral-400 ml-3">{t('Uloženo.', 'Saved.')}</span>}
      </form>
      <div className="max-w-lg">
        <CommentThread comments={comments} onSubmit={postComment} />
      </div>
    </div>
  )
}
