import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neovantas: {
          ink: '#101827',
          navy: '#142033',
          blue: '#2563eb',
          teal: '#0f766e',
          lime: '#84cc16',
          mist: '#eef4f7',
          line: '#d8e0e8',
        },
      },
      boxShadow: {
        panel: '0 16px 40px rgba(20, 32, 51, 0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
