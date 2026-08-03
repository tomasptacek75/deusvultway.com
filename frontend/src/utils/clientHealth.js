import { daysSince, daysUntil } from './date'

// Prahové hodnoty pro "potřebuje pozornost" na Overview.jsx dashboardu. Nejsou to
// Davidova čísla — jsou to navržené výchozí hodnoty, dá se snadno doladit na jednom místě.
export const STALE_FEEDBACK_DAYS = 7
export const CHALLENGE_ENDING_DAYS = 7
export const STALE_PAYMENT_DAYS = 35
export const STALE_PROGRESS_DAYS = 14
export const STALE_PLAN_EDIT_DAYS = 7

// Klíč signálu → jak ho pojmenovat a jak podle něj řadit tabulku na /trainer/clients
// (sortKey musí odpovídat poli z GET /clients, dir = výchozí směr řazení pro ten signál).
export const SIGNAL_META = {
  no_consultation: { label: 'bez příští konzultace', labelEn: 'no upcoming consultation', sortKey: 'next_consultation_date', dir: 'asc' },
  stale_feedback: { label: 'bez zpětné vazby', labelEn: 'no recent feedback', sortKey: 'last_feedback_at', dir: 'asc' },
  challenge_ending: { label: 'výzva brzy končí', labelEn: 'challenge ending soon', sortKey: 'challenge_end_date', dir: 'asc' },
  stale_payment: { label: 'bez platby', labelEn: 'no recent payment', sortKey: 'last_payment_at', dir: 'asc' },
  stale_progress: { label: 'bez pokroku od klienta', labelEn: 'no client progress', sortKey: 'last_progress_entry_at', dir: 'asc' },
  stale_plan: { label: 'plán neupraven', labelEn: 'plan not updated', sortKey: 'last_plan_edit_at', dir: 'asc' },
}

// Vrátí seznam klíčů signálů (z SIGNAL_META), které u daného klienta přesahují práh, nebo
// úplně chybí. Používá GET /clients pole přidaná pro tenhle dashboard (next_consultation_date,
// last_feedback_at, challenge_end_date, last_payment_at, last_progress_entry_at, last_plan_edit_at).
export function attentionSignals(client) {
  const signals = []
  if (!client.next_consultation_date) signals.push('no_consultation')
  if (client.last_feedback_at == null || daysSince(client.last_feedback_at) > STALE_FEEDBACK_DAYS) signals.push('stale_feedback')
  if (client.challenge_end_date && daysUntil(client.challenge_end_date) <= CHALLENGE_ENDING_DAYS) signals.push('challenge_ending')
  if (client.last_payment_at == null || daysSince(client.last_payment_at) > STALE_PAYMENT_DAYS) signals.push('stale_payment')
  if (client.last_progress_entry_at == null || daysSince(client.last_progress_entry_at) > STALE_PROGRESS_DAYS) signals.push('stale_progress')
  if (client.last_plan_edit_at == null || daysSince(client.last_plan_edit_at) > STALE_PLAN_EDIT_DAYS) signals.push('stale_plan')
  return signals
}
