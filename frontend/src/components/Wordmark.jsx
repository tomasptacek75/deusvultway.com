// "DEUS VULT WAY" rendered from hand-cut letter images (frontend/public/wordmark/*.png), not a
// font — the user supplied a one-off styled artwork of exactly this phrase and asked for it
// verbatim in the header, and no font file/license for that exact look was available. Each
// letter is masked (CSS mask-image) onto a colored box so VULT can stay red like the original
// text version. "W" and "a" ship as one combined image ("Wa.png") because the source art
// connects them with a single decorative flourish stroke that can't be split between the two
// letters without cutting through it.
//
// White letters deliberately have no explicit color class — they inherit currentColor from
// whatever wraps them, so e.g. Login.jsx's hover:text-blood-400 on the wrapping <Link> still
// visibly affects DEUS/WAY on hover, same as when this was plain text. VULT stays hardcoded
// text-blood-600 so it doesn't shift with that hover.
//
// heightPct is each letter's own cropped pixel height relative to the tallest letter in the
// source image (216px, "Wa") — without it every letter stretches to fill the same box height
// and the lowercase "eus"/"ult"/"ay" ends up as tall as the capitals, reading as if the whole
// wordmark were capitalized instead of matching the source's actual cap-height/x-height mix.
const LETTERS = [
  { id: 'D', ratio: '181/214', heightPct: 99 },
  { id: 'e', ratio: '87/140', heightPct: 65, gap: 'letter' },
  { id: 'u1', ratio: '110/142', heightPct: 66, gap: 'letter' },
  { id: 's', ratio: '94/141', heightPct: 65, gap: 'letter' },
  { id: 'V', ratio: '184/213', heightPct: 99, gap: 'word', color: 'text-blood-600' },
  { id: 'u2', ratio: '111/210', heightPct: 97, color: 'text-blood-600' },
  { id: 'l', ratio: '61/208', heightPct: 96, gap: 'letter', color: 'text-blood-600' },
  { id: 't', ratio: '79/179', heightPct: 83, gap: 'letter', color: 'text-blood-600' },
  { id: 'Wa', ratio: '346/216', heightPct: 100, gap: 'word' },
  { id: 'y', ratio: '105/188', heightPct: 87, gap: 'letter' },
]

const GAP_CLASS = { letter: 'ml-[3px]', word: 'ml-3' }

// mono: renders every letter in currentColor instead of hardcoding VULT to blood-600 — used by
// the black-and-white retro Landing.jsx redesign, which doesn't use the brand red at all.
export default function Wordmark({ className = 'h-7', mono = false }) {
  return (
    <span className={`inline-flex items-end shrink-0 ${className}`}>
      {LETTERS.map((letter) => (
        <span
          key={letter.id}
          className={`inline-block ${mono ? '' : letter.color || ''} ${GAP_CLASS[letter.gap] || ''}`}
          style={{
            height: `${letter.heightPct}%`,
            aspectRatio: letter.ratio,
            backgroundColor: 'currentColor',
            WebkitMaskImage: `url(/wordmark/${letter.id}.png)`,
            maskImage: `url(/wordmark/${letter.id}.png)`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'bottom left',
            maskPosition: 'bottom left',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
          }}
        />
      ))}
    </span>
  )
}
