// tailwind.config.js
import colors from 'tailwindcss/colors'; // Importa colors
import defaultTheme from 'tailwindcss/defaultTheme'; // Importa defaultTheme

/** @type {import('tailwindcss').Config} */
export default {
  // --- Habilitar modo oscuro basado en clases ---
  darkMode: 'class', // Habilita el modo oscuro usando la clase 'dark'
  // --- Fin Habilitar modo oscuro ---

  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // --- NUESTRA PALETA CÁLIDA Y ACOGEDORA (incluyendo modo oscuro) ---
      colors: {
        // Colores del Tema Claro (ya definidos)
        background: colors.stone['50'],      // Fondo general muy claro (#fafaf9)
        contrast: colors.white,              // Fondo para elementos como tarjetas/modales (#ffffff)
        primary: colors.stone,               // Usar como primary-700, primary-800 etc. (Claro)
        secondary: colors.amber,             // Usar como secondary-700, secondary-600 etc. (Claro)
        accent: colors.rose,                 // Usar como accent-500, accent-400 etc. (Claro)
        neutral: colors.stone,               // Grises cálidos (Claro)

        // Mapeo específico para texto (Claro)
        'text-base': colors.stone['800'],      // Color principal de texto (#292524)
        'text-muted': colors.stone['500'],     // Color secundario/tenue (#78716c)

        // --- Colores del Tema Oscuro ---
        // Usaremos nombres semánticos con prefijo 'dark'
        'dark-background': colors.stone['900'], // Fondo general oscuro (Ej: #0c0a09)
        'dark-contrast': colors.stone['800'],   // Fondo para elementos como tarjetas/modales oscuro (Ej: #292524)

        // Podemos redefinir las escalas de colores o usar tonos específicos para oscuro
        // Usaremos tonos más claros de las mismas paletas para texto y elementos
        'dark-primary': colors.stone, // Usar como dark-primary-200, dark-primary-300 etc.
        'dark-secondary': colors.amber, // Usar como dark-secondary-300, dark-secondary-400 etc.
        'dark-accent': colors.rose,     // Usar como dark-accent-300, dark-accent-400 etc.
        'dark-neutral': colors.stone,   // Grises cálidos (Oscuro)

        // Mapeo específico para texto (Oscuro)
        'dark-text-base': colors.stone['100'],  // Color principal de texto oscuro (Ej: #f5f5f4)
        'dark-text-muted': colors.stone['300'], // Color secundario/tenue oscuro (Ej: #d6d3d1)


        // Colores de estado (ajustar tonos para buen contraste en fondo oscuro)
        danger: colors.red,     // Usar como danger-600 (Claro) / danger-400 (Oscuro)
        success: colors.emerald, // Usar como success-600 (Claro) / success-400 (Oscuro)
        warning: colors.amber,   // Usar como warning-500 (Claro) / warning-400 (Oscuro)
      },
      // --- NUESTRA TIPOGRAFÍA (Mantener Inter para ambos modos) ---
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
  important: true,

  // Update the content option to include purge
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
    "./src/**/*.{html,css}",
  ],
}