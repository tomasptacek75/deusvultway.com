import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function DiaryBackLink() {
  return (
    <Link to="/diary" className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 mb-4">
      <ArrowLeft size={16} /> Přehled
    </Link>
  )
}
