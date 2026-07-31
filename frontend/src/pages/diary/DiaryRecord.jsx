import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mic, Square, Check, Calendar, Clock, NotebookPen, RotateCcw, Trash2, MicOff } from 'lucide-react'
import { apiClient } from '../../api/client'
import DiaryEntryEditor from '../../components/DiaryEntryEditor'
import TimeSelect from '../../components/TimeSelect'
import DiaryBackLink from '../../components/DiaryBackLink'

function pickMimeType() {
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
  for (const c of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(c)) return c
  }
  return ''
}

export default function DiaryRecord() {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [entry, setEntry] = useState(null)
  // 'unknown' | 'granted' | 'denied' | 'prompt' — Safari nepodporuje dotaz na 'microphone' přes
  // Permissions API, tam to zůstane 'unknown' a chová se to jako dřív (bez indikace předem).
  const [micPermission, setMicPermission] = useState('unknown')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const navigate = useNavigate()

  // Mikrofonní stream se mezi nahrávkami nezavírá (jen se stopne/spustí MediaRecorder nad ním) —
  // opakované getUserMedia po ukončení předchozích stop() na tracích některé prohlížeče (hlavně
  // iOS Safari v PWA režimu) berou jako nové oprávnění a znovu se ptají, i když bylo už jednou
  // povoleno. Stream se skutečně uvolní až při odchodu ze stránky (cleanup effect níže).
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  useEffect(() => {
    if (!navigator.permissions?.query) return
    let status
    navigator.permissions.query({ name: 'microphone' })
      .then((s) => {
        status = s
        setMicPermission(s.state)
        s.onchange = () => setMicPermission(s.state)
      })
      .catch(() => {})
    return () => { if (status) status.onchange = null }
  }, [])

  async function startRecording() {
    setError('')
    setEntry(null)
    try {
      let stream = streamRef.current
      if (!stream || stream.getTracks().some((t) => t.readyState === 'ended')) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
      }
      setMicPermission('granted')
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => uploadRecording(mimeType)
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicPermission('denied')
      } else if (err.name === 'NotFoundError') {
        setError('Na tomhle zařízení jsme nenašli mikrofon.')
      } else {
        setError('Nepodařilo se získat přístup k mikrofonu. Zkontroluj oprávnění prohlížeče.')
      }
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function uploadRecording(mimeType) {
    setProcessing(true)
    setError('')
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
      const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm'
      const form = new FormData()
      form.append('audio', blob, `trenink.${ext}`)
      const { data } = await apiClient.post('/diary/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setEntry(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Zpracování nahrávky selhalo, zkus to prosím znovu.')
    } finally {
      setProcessing(false)
    }
  }

  function recordAgain() {
    setEntry(null)
    setError('')
  }

  async function discardEntry() {
    if (!window.confirm('Opravdu zahodit tenhle záznam? Nic se neuloží.')) return
    try {
      await apiClient.delete(`/diary/entries/${entry.id}`)
    } finally {
      navigate('/diary')
    }
  }

  async function saveEdits() {
    setError('')
    try {
      await apiClient.put(`/diary/entries/${entry.id}`, {
        recorded_at: entry.recorded_at, notes: entry.notes, exercises: entry.exercises,
        start_time: entry.start_time, end_time: entry.end_time,
      })
      navigate('/diary')
    } catch {
      setError('Uložení se nepovedlo, zkus to prosím znovu.')
    }
  }

  return (
    <div>
      <DiaryBackLink />
      <h1 className="text-3xl mb-8">Namluvit trénink</h1>

      {error && <div className="text-blood-400 text-sm mb-4">{error}</div>}

      {!entry && (
        <div className="flex flex-col items-center justify-center py-12">
          {micPermission === 'denied' ? (
            <>
              <div className="w-24 h-24 rounded-full flex items-center justify-center bg-neutral-900 border border-blood-700">
                <MicOff className="text-blood-500" size={28} />
              </div>
              <p className="text-blood-400 text-sm mt-4 text-center max-w-xs">
                Přístup k mikrofonu je zablokovaný. Povol ho v nastavení prohlížeče (ikona zámku/„aA" vedle adresy, nebo Nastavení → Safari → Mikrofon) a stránku načti znovu.
              </p>
            </>
          ) : (
            <>
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={processing}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-colors ${
                  recording ? 'bg-blood-700 animate-pulse' : 'bg-neutral-900 border border-neutral-800 hover:border-blood-600'
                }`}
              >
                {recording ? <Square className="text-white" size={28} /> : <Mic className="text-blood-500" size={28} />}
              </button>
              <p className="text-neutral-400 text-sm mt-4 text-center max-w-xs">
                {processing ? 'Zpracovávám nahrávku, chvilku strpení…'
                  : recording ? 'Nahrávám… klepnutím ukonči'
                  : micPermission === 'granted' ? 'Klepni a popiš svůj trénink'
                  : 'Klepni a popiš svůj trénink — poprvé si prohlížeč vyžádá povolení k mikrofonu'}
              </p>
            </>
          )}
        </div>
      )}

      {entry && (
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
            <label className="flex items-center gap-2 mb-2">
              <Calendar size={14} />
              <span>Datum tréninku:</span>
              <input
                type="date" value={entry.recorded_at || ''}
                onChange={(e) => setEntry((prev) => ({ ...prev, recorded_at: e.target.value }))}
                className="px-2 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-200"
              />
            </label>
            <div className="flex items-center gap-2 gap-y-1.5 mb-2 flex-wrap">
              <Clock size={14} />
              <span>Čas:</span>
              <TimeSelect
                value={entry.start_time} onChange={(v) => setEntry((prev) => ({ ...prev, start_time: v }))}
                className="w-11 px-0 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm text-center appearance-none"
              />
              <span className="text-neutral-600">–</span>
              <TimeSelect
                value={entry.end_time} onChange={(v) => setEntry((prev) => ({ ...prev, end_time: v }))}
                className="w-11 px-0 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm text-center appearance-none"
              />
            </div>
            {entry.transcript && <div className="italic text-neutral-500">„{entry.transcript}“</div>}
          </div>

          <DiaryEntryEditor exercises={entry.exercises} onChange={(exercises) => setEntry((e) => ({ ...e, exercises }))} />

          <label className="block text-sm text-neutral-400">
            <span className="flex items-center gap-2 mb-1"><NotebookPen size={14} /> Poznámka</span>
            <textarea
              rows={3} value={entry.notes || ''}
              onChange={(e) => setEntry((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Únava před/po, jak se cvičilo, spánek, strava — cokoli, co mohlo ovlivnit trénink"
              className="w-full px-3 py-2 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-200 resize-y"
            />
          </label>

          <div className="flex items-center gap-3 pt-2 flex-wrap">
            <button onClick={saveEdits} className="px-4 py-2.5 rounded-md bg-blood-700 hover:bg-blood-600 font-medium flex items-center gap-2">
              <Check size={16} /> Uložit úpravy
            </button>
            <button onClick={recordAgain} className="px-4 py-2.5 rounded-md border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-medium flex items-center gap-2">
              <RotateCcw size={16} /> Nahrát znovu
            </button>
            <button onClick={discardEntry} className="px-4 py-2.5 rounded-md border border-neutral-800 hover:border-blood-700 text-neutral-300 font-medium flex items-center gap-2">
              <Trash2 size={16} /> Smazat
            </button>
            <Link to="/diary/history" className="text-sm text-neutral-400 hover:text-neutral-200 ml-auto">Do historie →</Link>
          </div>
        </div>
      )}
    </div>
  )
}
