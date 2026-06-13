import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ⚠️ En Tailwind v4 la fuente canónica de tokens es el bloque @theme de
      // app/globals.css. Esto se mantiene en sync con esos valores de marca.
      colors: {
        acento: '#CEDC00',          // Lima · Pantone 381 C
        'acento-hover': '#B9C600',
        menta: '#00C19F',           // Menta/Teal · Pantone 2240 C
        'menta-hover': '#00A98B',
        principal: '#072B31',       // Petróleo · Pantone 546 C
        fondo: '#F4F7F6',
        salvia: '#9AB9AD',          // Pantone 623 C
        'verde-claro': '#D1E0D7',   // Pantone 621 C
        arena: '#D6D9C7',           // Pantone 6197 C
        borde: 'rgba(7, 43, 49, 0.12)',
        muted: '#5F7A77',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Articulat CF', 'Inter', 'sans-serif'],
        numeric: ['BC Barell 1973', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
