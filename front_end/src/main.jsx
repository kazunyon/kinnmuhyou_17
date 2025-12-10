import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './print-fix.css'
import Modal from 'react-modal';

// モーダルを使用する際のおまじない
// ルート要素をアプリケーションのメイン要素として設定し、
// スクリーンリーダーがモーダルが開いているときにメインコンテンツを読み上げないようにします。
Modal.setAppElement('#root');

/**
 * アプリケーションのエントリーポイントです。
 * Reactのルートを作成し、Appコンポーネントをレンダリングします。
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
