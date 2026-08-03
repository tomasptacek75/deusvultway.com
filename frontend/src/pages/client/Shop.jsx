import { useEffect, useState } from 'react'
import { ShoppingBag, Shirt } from 'lucide-react'
import { apiClient } from '../../api/client'
import { useLanguage } from '../../i18n/LanguageContext'

const ORDER_STATUS_LABELS = {
  'nová': ['Nová', 'New'],
  'zaplaceno': ['Zaplaceno', 'Paid'],
  'vyřízeno': ['Vyřízeno', 'Fulfilled'],
  'zrušeno': ['Zrušeno', 'Cancelled'],
}

// Malý merch e-shop — objednávka je jen záznam pro Davida, žádné online placení (appka
// nemá platební bránu, viz CLAUDE.md). Obrázky produktů přes autentizovaný blob-fetch
// (ProductImage), stejný vzor jako PhotoThumb v Progress.jsx.
export default function Shop() {
  const { t } = useLanguage()
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [selections, setSelections] = useState({})
  const [placed, setPlaced] = useState(null)

  function load() {
    apiClient.get('/shop-products').then((r) => setProducts(r.data))
    apiClient.get('/shop-orders/me').then((r) => setOrders(r.data))
  }

  useEffect(load, [])

  async function order(product) {
    const size = selections[product.id]
    await apiClient.post('/shop-orders', { product_id: product.id, size: size || null, quantity: 1 })
    setPlaced(product.id)
    setTimeout(() => setPlaced(null), 2500)
    load()
  }

  return (
    <div>
      <h1 className="text-3xl mb-8 flex items-center gap-3">
        <ShoppingBag className="text-blood-600" /> {t('E-shop', 'Shop')}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {products.map((p) => {
          const sizes = p.sizes ? p.sizes.split(',') : []
          return (
            <div key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden flex flex-col">
              <div className="aspect-square bg-neutral-950 flex items-center justify-center">
                {p.image_path ? <ProductImage id={p.id} name={p.name} /> : <Shirt className="text-neutral-700" size={40} />}
              </div>
              <div className="p-4 flex flex-col gap-2 flex-1">
                <div className="font-semibold">{t(p.name, p.name_en || p.name)}</div>
                {p.description && <p className="text-sm text-neutral-400">{t(p.description, p.description_en || p.description)}</p>}
                <div className="text-lg font-display text-blood-500">{p.price_kc} Kč</div>
                {sizes.length > 0 && (
                  <select
                    value={selections[p.id] || ''}
                    onChange={(e) => setSelections({ ...selections, [p.id]: e.target.value })}
                    className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">{t('Vyber velikost', 'Select size')}</option>
                    {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                <button
                  onClick={() => order(p)}
                  disabled={sizes.length > 0 && !selections[p.id]}
                  className="mt-auto bg-blood-700 hover:bg-blood-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-md px-4 py-2 text-sm font-medium"
                >
                  {placed === p.id ? t('Objednáno ✓', 'Ordered ✓') : t('Objednat', 'Order')}
                </button>
              </div>
            </div>
          )
        })}
        {products.length === 0 && <p className="text-neutral-500 col-span-full">{t('E-shop je zatím prázdný.', 'The shop is empty for now.')}</p>}
      </div>

      <h2 className="text-lg mb-3 text-neutral-300">{t('Moje objednávky', 'My orders')}</h2>
      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-md bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm">
            <div>
              <span className="font-medium">{t(o.product_name, o.product_name_en || o.product_name)}</span>
              {o.size && <span className="text-neutral-500"> · {o.size}</span>}
              <span className="text-neutral-500"> · {o.quantity}× {o.price_kc} Kč</span>
            </div>
            <span className="text-xs text-neutral-400 shrink-0">{t(...ORDER_STATUS_LABELS[o.status])}</span>
          </div>
        ))}
        {orders.length === 0 && <p className="text-neutral-500 text-sm">{t('Zatím žádné objednávky.', 'No orders yet.')}</p>}
      </div>
    </div>
  )
}

function ProductImage({ id, name }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let objectUrl
    apiClient.get(`/shop-products/${id}/image`, { responseType: 'blob' }).then((r) => {
      objectUrl = URL.createObjectURL(r.data)
      setUrl(objectUrl)
    })
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [id])

  if (!url) return <div className="w-full h-full bg-neutral-900 animate-pulse" />
  return <img src={url} alt={name} className="w-full h-full object-cover" />
}
