import { useEffect, useState } from 'react'
import { UsersRound, Plus, Trash2, X } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'

export default function Teams() {
  const { t } = useLanguage()
  const [teams, setTeams] = useState([])
  const [clients, setClients] = useState([])
  const [name, setName] = useState('')
  const [addingTo, setAddingTo] = useState(null)
  const [pickClient, setPickClient] = useState('')

  function load() {
    apiClient.get('/teams').then((r) => setTeams(r.data))
  }

  useEffect(() => {
    load()
    apiClient.get('/clients').then((r) => setClients(r.data))
  }, [])

  async function createTeam(e) {
    e.preventDefault()
    if (!name.trim()) return
    await apiClient.post('/teams', { name: name.trim() })
    setName('')
    load()
  }

  async function deleteTeam(id) {
    await apiClient.delete(`/teams/${id}`)
    load()
  }

  async function addMember(teamId) {
    if (!pickClient) return
    await apiClient.post(`/teams/${teamId}/members`, { client_id: Number(pickClient) })
    setPickClient('')
    setAddingTo(null)
    load()
  }

  async function removeMember(teamId, clientId) {
    await apiClient.delete(`/teams/${teamId}/members/${clientId}`)
    load()
  }

  return (
    <div>
      <h1 className="text-3xl mb-6 flex items-center gap-3">
        <UsersRound className="text-blood-600" /> {t('Týmy', 'Teams')}
      </h1>

      <form onSubmit={createTeam} className="mb-8 rounded-lg border border-neutral-800 bg-neutral-900 p-5 flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('Název týmu (např. Powerlifting skupina)', 'Team name (e.g. Powerlifting group)')}
          className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2"
        />
        <button type="submit" className="flex items-center gap-1.5 bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-4 py-2 font-medium">
          <Plus size={16} /> {t('Vytvořit tým', 'Create team')}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.map((team) => (
          <div key={team.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-lg">{team.name}</div>
              <button onClick={() => deleteTeam(team.id)} className="text-neutral-600 hover:text-blood-500">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="space-y-1.5 mb-3">
              {team.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5">
                  {m.display_name}
                  <button onClick={() => removeMember(team.id, m.id)} className="text-neutral-600 hover:text-blood-500">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {team.members.length === 0 && <p className="text-neutral-500 text-sm">{t('Žádní členové.', 'No members.')}</p>}
            </div>
            {addingTo === team.id ? (
              <div className="flex gap-2">
                <select value={pickClient} onChange={(e) => setPickClient(e.target.value)} className="flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-2 py-1.5 text-sm">
                  <option value="">{t('Vyber klienta…', 'Select a client…')}</option>
                  {clients.filter((c) => !team.members.some((m) => m.id === c.id)).map((c) => (
                    <option key={c.id} value={c.id}>{c.display_name}</option>
                  ))}
                </select>
                <button onClick={() => addMember(team.id)} className="bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-3 py-1.5 text-sm">{t('Přidat', 'Add')}</button>
              </div>
            ) : (
              <button onClick={() => setAddingTo(team.id)} className="text-sm text-blood-500 hover:text-blood-400">+ {t('Přidat člena', 'Add member')}</button>
            )}
          </div>
        ))}
        {teams.length === 0 && <p className="text-neutral-500">{t('Zatím žádné týmy.', 'No teams yet.')}</p>}
      </div>
    </div>
  )
}
