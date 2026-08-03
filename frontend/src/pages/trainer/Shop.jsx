import { useEffect, useState } from 'react'
import { ShoppingBag, Plus, Pencil, Eye, EyeOff, ChevronDown, ChevronUp, Upload } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'

const emptyForm = { name: '', name_en: '', price_kc: '', sizes: '', category: '' }

const ORDER_STATUS_LABELS = {
  'nová': ['Nová', 'New'],
  'zaplaceno': ['Zaplaceno', 'Paid'],
  'vyřízeno': ['Vyřízeno', 'Fulfilled'],
  'zrušeno': ['Zrušeno', 'Cancelled'],
}
const ORDER_STATUS_OPTIONS = ['nová', 'zaplaceno', 'vyřízeno', 'zrušeno']

// Malý merch e-shop (trička, kraťasy, doplňky) — žádná platební brána, objednávka je jen
// záznam, který trenér ručně posouvá přes stavy (stejný princip jako subscriptions/
// payments). Produkty spravovány stejným vzorem jako Tiers.jsx/Equipment.jsx (hide-not-
// delete, expandable karty), sizes je volný text na produktu, ne spravovaný katalog.
export default function Shop() {
  const { t } = useLanguage()
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [expanded, setExpanded] = useState(null)

  function load() {
    apiClient.get('/shop-products', { params: { include_inactive: 1 } }).then((r) => setProducts(r.data))
    apiClient.get('/shop-orders').then((r) => setOrders(r.data))
  }

  useEffect(load, [])

  async function createProduct(e) {
    e.preventDefault()
    await apiClient.post('/shop-products', { ...form, price_kc: Number(form.price_kc), sizes: form.sizes || null })
    setForm(emptyForm)
    setShowForm(false)
    load()
  }

  async function toggleActive(product) {
    await apiClient.put(`/shop-products/${product.id}`, { active: product.active ? 0 : 1 })
    load()
  }

  function startEdit(product) {
    setEditingId(product.id)
    setEditForm({
      name: product.name, name_en: product.name_en ?? '', price_kc: product.price_kc,
      sizes: product.sizes ?? '', category: product.category ?? '',
    })
  }

  async function saveEdit(e) {
    e.preventDefault()
    await apiClient.put(`/shop-products/${editingId}`, { ...editForm, price_kc: Number(editForm.price_kc), sizes: editForm.sizes || null })
    setEditingId(null)
    load()
  }

  async function uploadImage(productId, file) {
    const data = new FormData()
    data.append('image', file)
    await apiClient.post(`/shop-products/${productId}/image`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
    load()
  }

  async function setOrderStatus(id, status) {
    await apiClient.put(`/shop-orders/${id}/status`, { status })
    load()
  }

  return (
    <div>
      <h1 className="text-3xl mb-6 flex items-center gap-3">
        <ShoppingBag className="text-blood-600" /> {t('E-shop', 'Shop')}
      </h1>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg text-neutral-300">{t('Produkty', 'Products')}</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 bg-blood-700 hover:bg-blood-600 transition-colors px-3 py-1.5 rounded-md text-sm font-medium"
        >
          <Plus size={16} /> {t('Nový produkt', 'New product')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createProduct} className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <input required placeholder={t('Název', 'Name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="md:col-span-2 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
          <input required type="number" placeholder="Kč" value={form.price_kc} onChange={(e) => setForm({ ...form, price_kc: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
          <input placeholder={t('Kategorie', 'Category')} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
          <input placeholder={t('Velikosti (S,M,L…)', 'Sizes (S,M,L…)')} value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm" />
          <button type="submit" className="md:col-span-5 bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-4 py-2 text-sm font-medium">{t('Uložit', 'Save')}</button>
        </form>
      )}

      <div className="space-y-3 mb-10">
        {products.map((p) => (
          <div key={p.id} className={`rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden ${p.active ? '' : 'opacity-50'}`}>
            <div className="flex items-center justify-between p-4">
              <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                {expanded === p.id ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
                <span className="font-semibold truncate">{t(p.name, p.name_en || p.name)}</span>
                <span className="text-xs text-neutral-500 shrink-0">{p.price_kc} Kč</span>
                {p.category && <span className="text-xs text-neutral-500 shrink-0">· {p.category}</span>}
              </button>
              <button onClick={() => toggleActive(p)} className="text-neutral-600 hover:text-blood-500 shrink-0" title={p.active ? t('Skrýt', 'Hide') : t('Odkrýt', 'Show')}>
                {p.active ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            {expanded === p.id && (
              <div className="border-t border-neutral-800 p-4">
                {editingId === p.id ? (
                  <form onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
                    <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-sm" />
                    <input required type="number" value={editForm.price_kc} onChange={(e) => setEditForm({ ...editForm, price_kc: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-sm" />
                    <input placeholder={t('Kategorie', 'Category')} value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-sm" />
                    <input placeholder={t('Velikosti', 'Sizes')} value={editForm.sizes} onChange={(e) => setEditForm({ ...editForm, sizes: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-sm" />
                    <div className="md:col-span-4 flex gap-2">
                      <button type="submit" className="flex-1 bg-blood-700 hover:bg-blood-600 transition-colors rounded-md px-3 py-1.5 text-sm font-medium">{t('Uložit', 'Save')}</button>
                      <button type="button" onClick={() => setEditingId(null)} className="flex-1 bg-neutral-800 hover:bg-neutral-700 transition-colors rounded-md px-3 py-1.5 text-sm font-medium">{t('Zrušit', 'Cancel')}</button>
                    </div>
                  </form>
                ) : (
                  <button onClick={() => startEdit(p)} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-blood-500 mb-3">
                    <Pencil size={13} /> {t('Upravit', 'Edit')}
                  </button>
                )}
                <label className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-blood-500 cursor-pointer w-fit">
                  <Upload size={13} /> {p.image_path ? t('Nahradit obrázek', 'Replace image') : t('Nahrát obrázek', 'Upload image')}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(p.id, e.target.files[0])} />
                </label>
              </div>
            )}
          </div>
        ))}
        {products.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím žádné produkty.', 'No products yet.')}</p>}
      </div>

      <h2 className="text-lg text-neutral-300 mb-3">{t('Objednávky', 'Orders')}</h2>
      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{o.client_name}</div>
                <div className="text-sm text-neutral-400">
                  {t(o.product_name, o.product_name_en || o.product_name)}
                  {o.size && ` · ${o.size}`} · {o.quantity}× · {o.price_kc * o.quantity} Kč
                </div>
                {o.note && <div className="text-xs text-neutral-500 mt-0.5">{o.note}</div>}
              </div>
              <span className={`shrink-0 text-xs rounded px-2 py-1 ${o.status === 'vyřízeno' ? 'bg-blood-900/40 text-blood-400' : o.status === 'zrušeno' ? 'bg-neutral-800 text-neutral-500' : 'bg-neutral-800 text-neutral-300'}`}>
                {t(...ORDER_STATUS_LABELS[o.status])}
              </span>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {ORDER_STATUS_OPTIONS.filter((s) => s !== o.status).map((s) => (
                <button key={s} onClick={() => setOrderStatus(o.id, s)} className="text-xs bg-neutral-800 hover:bg-blood-700 transition-colors rounded-md px-3 py-1.5">
                  {t(...ORDER_STATUS_LABELS[s])}
                </button>
              ))}
            </div>
          </div>
        ))}
        {orders.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím žádné objednávky.', 'No orders yet.')}</p>}
      </div>
    </div>
  )
}
