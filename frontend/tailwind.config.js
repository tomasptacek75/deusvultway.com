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
