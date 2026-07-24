import { apiClient } from './api/client'

// Fronta v localStorage pro zápis sérií bez signálu (nefunkční požadavek "offline režim") —
// ne plná PWA se service workerem, jen samotný zápis výkonu (nejčastější akce v posilovně,
// kde bývá špatné připojení). Každá položka má client_ref (UUID) — backend ho použije pro
// idempotenci, takže retry po výpadku sítě nikdy nevytvoří duplicitní sérii.
const KEY = 'bg_offline_queue'

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function readQueue() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

function writeQueue(q) {
  localStorage.setItem(KEY, JSON.stringify(q))
}

export function getQueuedCount() {
  return readQueue().length
}

// Odešle zápis série. Při chybě sítě (ne validace/auth) uloží do fronty a vrátí { queued: true }.
export async function logSet(workoutExerciseId, payload) {
  const body = { ...payload, client_ref: uuid() }
  try {
    const { data } = await apiClient.post(`/workout-exercises/${workoutExerciseId}/logs`, body)
    return { queued: false, data }
  } catch (err) {
    if (err.response) throw err // server odpověděl (400/401/…) — skutečná chyba, ne offline
    const q = readQueue()
    q.push({ id: body.client_ref, url: `/workout-exercises/${workoutExerciseId}/logs`, body, created_at: Date.now() })
    writeQueue(q)
    return { queued: true }
  }
}

export async function flushQueue() {
  const q = readQueue()
  if (q.length === 0) return 0
  let flushed = 0
  const remaining = []
  for (const item of q) {
    try {
      await apiClient.post(item.url, item.body)
      flushed++
    } catch (err) {
      if (err.response) { flushed++; continue } // server ho už odmítl definitivně, nezacyklovat
      remaining.push(item) // pořád offline — nech ve frontě, zkusit příště
    }
  }
  writeQueue(remaining)
  return flushed
}

export function initOfflineSync(onFlush) {
  const tryFlush = async () => {
    const n = await flushQueue()
    if (n > 0 && onFlush) onFlush(n)
  }
  window.addEventListener('online', tryFlush)
  const interval = setInterval(tryFlush, 30000)
  tryFlush()
  return () => { window.removeEventListener('online', tryFlush); clearInterval(interval) }
}
