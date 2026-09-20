import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/cgullmapi': {
        target: 'https://air.cgu.edu.tw',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
