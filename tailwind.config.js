/**
 * Настройки Tailwind для сборки.
 *
 * Раньше их держал сам index.html рядом со скриптом с CDN. Разница не только
 * в удобстве: CDN сканировал живую страницу и находил классы, появившиеся в
 * рантайме, а сборка видит только текст в файлах ниже. Поэтому классы нельзя
 * собирать из кусков в рантайме — их надо писать целиком в коде.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Через rgb(... / <alpha-value>) — иначе прозрачность не работает:
        // bg-brand-bg/95 просто не создаётся, и элемент остаётся без фона.
        brand: {
          bg: 'rgb(var(--color-bg-rgb) / <alpha-value>)',
          text: 'rgb(var(--color-text-rgb) / <alpha-value>)',
          border: 'rgb(var(--color-border-rgb) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
