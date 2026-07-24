import { useEffect, useState } from 'react'
import { Inbox, Mail, Phone } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'

export default function Inquiries() {
  const { t } = useLanguage()
  const [inquiries, setInquiries] = useState([])

  useEffect(() => {
    apiClient.get('/inquiries').then((r) => setInquiries(r.data))
  }, [])

  return (
    <div>
      <h1 className="text-3xl mb-6 flex items-center gap-3">
        <Inbox className="text-blood-600" /> {t('Poptávky', 'Inquiries')}
      </h1>
      <div className="space-y-3">
        {inquiries.map((i) => (
          <div key={i.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">{i.name}</div>
              <div className="text-xs text-neutral-500">{i.created_at}</div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
              <a href={`mailto:${i.email}`} className="flex items-center gap-1.5 text-sm text-blood-500 hover:underline w-fit">
                <Mail size={14} /> {i.email}
              </a>
              {i.phone && (
                <a href={`tel:${i.phone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 text-sm text-blood-500 hover:underline w-fit">
                  <Phone size={14} /> {i.phone}
                </a>
              )}
            </div>
            <p className="text-sm text-neutral-300 whitespace-pre-line">{i.message}</p>
          </div>
        ))}
        {inquiries.length === 0 && <p className="text-neutral-500">{t('Zatím žádné poptávky z landing page.', 'No inquiries from the landing page yet.')}</p>}
      </div>
    </div>
  )
}
