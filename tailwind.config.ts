import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neovantas: {
          ink: '#0A0A3F',
          navy: '#0A0A3F',
          blue: '#001F99',
          accent: '#58DDFE',
          teal: '#00A98F',
          lime: '#84cc16',
          mist: '#E6E8EB',
          line: '#C8C8C8',
          muted: '#958C86',
        },
      },
      boxShadow: {
        panel: '0 2px 16px rgba(13, 30, 61, 0.07)',
        elevated: '0 18px 45px rgba(13, 30, 61, 0.12)',
      },
      fontFamily: {
        sans: ['Montserrat', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
