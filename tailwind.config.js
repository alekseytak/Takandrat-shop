/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          bg: 'var(--color-bg)',
          text: 'var(--color-text)',
          border: 'var(--color-border)',
          accent: 'var(--color-accent)',
        }
      },
      fontFamily: {
        mono: ['Space Mono', 'monospace'],
        sans: ['Space Grotesk', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
