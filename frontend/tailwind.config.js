/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Desaturated to grey for the app-wide retro pass (2026-08-13) — same relative
        // lightness as the original red scale at every step (converted via perceptual
        // luminance, 0.299R+0.587G+0.114B, not picked by eye), so every existing contrast
        // pairing that was already tuned to work (e.g. white button text on bg-blood-700,
        // text-blood-600 reading as a bright accent against neutral-950) keeps working
        // identically — only the hue changes, not who's readable against what.
        blood: {
          50: '#f6f6f6',
          100: '#eaeaea',
          200: '#dadada',
          300: '#bfbfbf',
          400: '#999999',
          500: '#777777',
          600: '#5c5c5c',
          700: '#4b4b4b',
          800: '#414141',
          900: '#3a3a3a',
        },
        // App-wide dark→light flip (2026-08-14, at the user's request — "zbytek webu ať je
        // taky světlý jako Landing page"). `neutral` is the ONLY grey scale used anywhere in
        // frontend/src (confirmed via grep — no gray-*/zinc-*/slate-* mixed in), and every
        // page's dark theme comes from routing bg/text/border through neutral-50..neutral-950
        // (body itself is bg-neutral-950 text-neutral-100 in index.css). So instead of rewriting
        // bg-neutral-900/text-neutral-100/border-neutral-800 across 40+ files, this mirrors the
        // blood-* trick: redefine the token scale itself. Here it's a straight MIRROR of
        // Tailwind's own default neutral values (950↔50, 900↔100, 800↔200, ... 500 stays put) —
        // not new colors, just the existing well-tested perceptual steps run in the opposite
        // direction — so bg-neutral-950 (was near-black page bg) becomes near-white, and
        // text-neutral-100 (was near-white body text) becomes near-black, while every mid-scale
        // border/hover/muted-text pairing keeps the same relative contrast it always had.
        neutral: {
          50: '#0a0a0a',
          100: '#171717',
          200: '#262626',
          300: '#404040',
          400: '#525252',
          500: '#737373',
          600: '#a3a3a3',
          700: '#d4d4d4',
          800: '#e5e5e5',
          900: '#f5f5f5',
          950: '#fafafa',
        },
        // Landing.jsx was deliberately left untouched by the neutral-* light-flip above (2026-08-14
        // follow-up: "Poslední změna změnila i landing page, tu jsem chtěl nechat netknutou" — the
        // last change also changed the landing page, which was meant to stay untouched). Landing.jsx
        // was built (2026-08-07) using plain neutral-* classes for its borders/dark-hero-section/
        // muted text, on the assumption neutral-900 is near-black and neutral-300/400/500 are mid
        // greys — exactly Tailwind's stock values. Since `neutral` itself is now inverted app-wide,
        // Landing.jsx's neutral-* usages were switched to this `ink` scale instead, which is just
        // Tailwind's untouched default neutral palette copied verbatim under a new name — restores
        // Landing.jsx pixel-for-pixel to how it looked before the app-wide flip, without needing a
        // second/parallel neutral scale that would conflict with the rest of the app.
        ink: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
      },
      fontFamily: {
        // App-wide retro reskin (2026-08-13, at the user's request) — display/sans now point
        // at the same self-hosted Anton/PT Serif faces used on the Landing.jsx redesign
        // (index.css has the @font-face rules), so every h1–h4 and body element across the
        // whole app (trainer + client portal, not just Landing) picks them up automatically.
        // retro/retroserif kept as explicit aliases too, for anything that wants them by name.
        display: ['"Anton"', 'sans-serif'],
        sans: ['"PTSerif"', 'Georgia', 'serif'],
        retro: ['"Anton"', 'sans-serif'],
        retroserif: ['"PTSerif"', 'Georgia', 'serif'],
      },
      borderRadius: {
        // Vintage print/poster look uses sharp-cornered rules and cards, not soft rounded-xl
        // SaaS corners — flattened app-wide instead of hunting down every rounded-* class.
        none: '0',
        sm: '0',
        DEFAULT: '0',
        md: '0',
        lg: '0',
        xl: '0',
        '2xl': '0',
        '3xl': '0',
        full: '9999px',
      },
    },
  },
  plugins: [],
}
