import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neovantas: {
          ink: '#1A2340',
          navy: '#0D1E3D',
          blue: '#1A4A8A',
          accent: '#2E7CF6',
          teal: '#00A98F',
          lime: '#84cc16',
          mist: '#F5F6FA',
          line: '#E2E6F0',
          muted: '#6B7999',
        },
      },
      boxShadow: {
        panel: '0 2px 16px rgba(13, 30, 61, 0.07)',
        elevated: '0 18px 45px rgba(13, 30, 61, 0.12)',
      },
      fontFamily: {
        sans: ['DM Sans', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['DM Serif Display', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
