// Jednoduchý bezzávislostní SVG čárový graf — použito pro trend 1RM a tělesné váhy (K3).
export default function Chart({ data, valueKey = 'value', labelKey = 'label', height = 160, unit = '' }) {
  if (!data || data.length === 0) {
    return <p className="text-neutral-500 text-sm">Zatím nedostatek dat pro graf.</p>
  }

  const width = 600
  const padding = { top: 16, right: 16, bottom: 24, left: 40 }
  const values = data.map((d) => Number(d[valueKey]))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const points = data.map((d, i) => {
    const x = padding.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
    const y = padding.top + innerH - ((Number(d[valueKey]) - min) / range) * innerH
    return { x, y, d }
  })

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${path} L${points[points.length - 1].x.toFixed(1)},${padding.top + innerH} L${points[0].x.toFixed(1)},${padding.top + innerH} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="chartFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + innerH} stroke="#262626" />
      <line x1={padding.left} y1={padding.top + innerH} x2={width - padding.right} y2={padding.top + innerH} stroke="#262626" />
      <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" fontSize="10" fill="#737373">{max.toFixed(0)}{unit}</text>
      <text x={padding.left - 8} y={padding.top + innerH} textAnchor="end" fontSize="10" fill="#737373">{min.toFixed(0)}{unit}</text>
      <path d={areaPath} fill="url(#chartFade)" />
      <path d={path} fill="none" stroke="#dc2626" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#dc2626" />
      ))}
      <text x={points[0].x} y={height - 4} fontSize="10" fill="#737373" textAnchor="start">{data[0][labelKey]}</text>
      <text x={points[points.length - 1].x} y={height - 4} fontSize="10" fill="#737373" textAnchor="end">{data[data.length - 1][labelKey]}</text>
    </svg>
  )
}
