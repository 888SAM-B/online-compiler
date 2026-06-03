/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#030712',
          900: '#0b0f19',
          800: '#111827',
          750: '#182235',
          700: '#1f2937',
          600: '#374151',
        },
        brand: {
          purple: '#8b5cf6',
          violet: '#6366f1',
          teal: '#14b8a6',
          green: '#10b981',
          crimson: '#ef4444',
          orange: '#f97316'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
