import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // フロントエンドの開発サーバーを5173番ポートで起動
    port: 5173,
    // APIリクエストをバックエンド(Flask)に転送するためのプロキシ設定
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000', // Flaskサーバーのアドレス
        changeOrigin: true,
      },
    },
  },
})
