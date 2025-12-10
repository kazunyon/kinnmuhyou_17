import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite の設定ファイルです。
 * React プラグインの設定や、開発サーバーのプロキシ設定を含みます。
 *
 * @see https://vitejs.dev/config/
 */
export default defineConfig({
  plugins: [react()],
  server: {
    /**
     * フロントエンドの開発サーバーのポート番号。
     * デフォルトで 5173 を使用します。
     */
    port: 5173,
    /**
     * API リクエストのプロキシ設定。
     * '/api' で始まるリクエストをバックエンド (Flask) サーバーに転送します。
     */
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000', // Flaskサーバーのアドレス
        changeOrigin: true,
      },
    },
  },
})
