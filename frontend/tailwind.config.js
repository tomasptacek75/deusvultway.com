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
        display: ['"Oswald"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif'],
        // Blackletter wordmark font pro "DEUS VULT WAY" v hlavičkách (AppShell/Landing/Login)
        // — CL Antique No.31 (viz zadání) je placený font z centurylibrary.com. UnifrakturMaguntia
        // (Fraktur) byl první pokus, ale strukturálně to je jiná rodina písma (zaoblené baňky)
        // než anglický Old English Text/Textura styl ze zadání — Old London (self-hosted, viz
        // index.css) je nejbližší volně dostupná náhrada se stejnou kostrou písmen.
        gothic: ['"OldLondon"', 'cursive'],
      },
    },
  },
  plugins: [],
}
