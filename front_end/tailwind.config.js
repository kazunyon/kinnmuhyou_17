/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // メインフォントを 'BIZ UDPゴシック' に設定
        sans: ['"BIZ UDPGothic"', 'sans-serif'],
      },
      fontSize: {
        // フォントサイズ 10pt を 'xs' とほぼ同等として設定
        '10pt': '0.8rem',
      },
      colors: {
        // 土曜日の背景色
        'saturday-blue': '#e0f7fa',
        // 日曜日・祝日の背景色
        'holiday-red': '#ffebee',
        // 選択行の背景色
        'selected-yellow': '#fff9c4',
      },
    },
  },
  plugins: [],
}
