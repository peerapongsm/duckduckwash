/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fredoka', 'sans-serif'],
        body: ['Nunito', 'sans-serif']
      },
      boxShadow: {
        soft: '0 4px 14px -2px rgba(58, 46, 20, 0.12)',
        lift: '0 10px 24px -6px rgba(58, 46, 20, 0.18)'
      }
    }
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        duckwash: {
          primary: '#FFC93C',
          'primary-content': '#3A2E14',
          secondary: '#4FA8D8',
          'secondary-content': '#FFFFFF',
          accent: '#FF8A5C',
          'accent-content': '#3A2114',
          neutral: '#344256',
          'neutral-content': '#FFF8EC',
          'base-100': '#FFFBF2',
          'base-200': '#FFF3DC',
          'base-300': '#F3E5C3',
          'base-content': '#2F3A4A',
          info: '#4FA8D8',
          success: '#3FA66A',
          warning: '#E8A317',
          error: '#D9534F',
          '--rounded-box': '1.25rem',
          '--rounded-btn': '1rem',
          '--animation-btn': '0.2s'
        }
      }
    ]
  }
}
