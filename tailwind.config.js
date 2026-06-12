/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [require('daisyui')],
  daisyui: { themes: ['corporate'] }
}
