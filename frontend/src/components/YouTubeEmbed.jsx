function extractYouTubeId(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1]
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1]
    }
  } catch {
    return null
  }
  return null
}

// Vloží YouTube video (i unlisted odkazy) jako responzivní přehrávač; u ostatních URL
// (nebo když se ID nepodaří rozparsovat) spadne zpět na obyčejný odkaz "otevřít video".
export default function YouTubeEmbed({ url, label = 'Otevřít video' }) {
  if (!url) return null
  const id = extractYouTubeId(url)

  if (!id) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-blood-500 hover:underline text-sm">
        {label}
      </a>
    )
  }

  return (
    <div className="relative w-full rounded-md overflow-hidden bg-black" style={{ paddingTop: '56.25%' }}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-0"
      />
    </div>
  )
}
