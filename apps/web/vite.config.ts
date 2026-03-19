import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 프론트 -> 벡엔드 API 프록시 설정
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});