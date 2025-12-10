/**
 * Tailwind CSS の設定ファイルです。
 * プロジェクト内で使用するカラーパレット、フォントファミリ、コンテンツパスなどを定義します。
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        /**
         * メインフォントファミリーの設定。
         * 'BIZ UDPゴシック' を優先的に使用します。
         */
        sans: ['"BIZ UDPGothic"', 'sans-serif'],
      },
      fontSize: {
        /**
         * 独自のフォントサイズ設定。
         * 10pt (約 0.8rem) を定義しています。
         */
        '10pt': '0.8rem',
      },
      colors: {
        /** 土曜日の背景色 */
        'saturday-blue': '#e0f7fa',
        /** 日曜日・祝日の背景色 */
        'holiday-red': '#ffebee',
        /** 選択行の背景色 */
        'selected-yellow': '#fff9c4',
      },
    },
  },
  plugins: [],
}
