import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Intercepta cualquier petición que empiece con /api-dolar
      '/api-dolar': {
        target: 'https://dolarflashve.eu', // El servidor real
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-dolar/, '/api'), // Reescribe la ruta para que coincida con la API
      }
    }
  }
})
