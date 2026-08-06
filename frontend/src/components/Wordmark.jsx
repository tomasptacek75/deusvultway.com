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
const LETTERS = [
  { id: 'D', ratio: '181/214' },
  { id: 'e', ratio: '87/140', gap: 'letter' },
  { id: 'u1', ratio: '110/142', gap: 'letter' },
  { id: 's', ratio: '94/141', gap: 'letter' },
  { id: 'V', ratio: '184/213', gap: 'word', color: 'text-blood-600' },
  { id: 'u2', ratio: '111/210', color: 'text-blood-600' },
  { id: 'l', ratio: '61/208', gap: 'letter', color: 'text-blood-600' },
  { id: 't', ratio: '79/179', gap: 'letter', color: 'text-blood-600' },
  { id: 'Wa', ratio: '346/216', gap: 'word' },
  { id: 'y', ratio: '105/188', gap: 'letter' },
]

const GAP_CLASS = { letter: 'ml-[3px]', word: 'ml-3' }

export default function Wordmark({ className = 'h-7' }) {
  return (
    <span className={`inline-flex items-end shrink-0 ${className}`}>
      {LETTERS.map((letter) => (
        <span
          key={letter.id}
          className={`h-full inline-block ${letter.color || ''} ${GAP_CLASS[letter.gap] || ''}`}
          style={{
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
