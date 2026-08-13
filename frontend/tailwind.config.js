/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        blood: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
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
