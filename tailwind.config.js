
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./*.js",
    "./components/**/*.{html,js}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      colors: {
        'fluxora': {
          'purple': '#a855f7',
          'blue': '#3b82f6',
          'cyan': '#06b6d4',
          'dark': '#0a0b14',
          'darker': '#1e1b4b',
        }
      }
    },
  },
  plugins: [],
}
