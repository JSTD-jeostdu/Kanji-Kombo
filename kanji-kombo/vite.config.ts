import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// GitHub Pages는 https://<아이디>.github.io/Kanji-Kombo/ 처럼 하위 경로로 서비스된다.
// base를 맞춰 두지 않으면 배포본에서 CSS·JS 주소가 어긋나 화면이 비어 보인다.
// 개발 서버(localhost)에서는 항상 루트라 '/'를 쓴다.
const base = process.env.GITHUB_ACTIONS ? '/Kanji-Kombo/' : '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
