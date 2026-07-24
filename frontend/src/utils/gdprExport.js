import { apiClient } from '../api/client'

// GET /me/export existuje v backendu už od dřívějška, ale nikdy na něj nenavazovalo žádné UI —
// tohle je ta chybějící druhá půlka (stáhne JSON export vlastních dat do souboru).
export async function downloadMyDataExport() {
  const { data } = await apiClient.get('/me/export')
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bloodandguts-data-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
