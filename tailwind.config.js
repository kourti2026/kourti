/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        kourti: {
          // Primaire — orange chaud (V2)
          orange: '#E85C0D',
          'orange-light': '#FB923C',
          'orange-dark':  '#C2410C',
          'orange-bg':    '#FFF7ED',
          // Secondaire — vert (états positifs, badges, succès)
          green:  '#166534',
          light:  '#22c55e',
          dark:   '#14532d',
          bg:     '#f0fdf4',
        }
      },
      fontFamily: {
        arabic: ['Noto Sans Arabic', 'sans-serif'],
      }
    }
  },
  plugins: []
}
