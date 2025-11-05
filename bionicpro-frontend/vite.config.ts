import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Конфигурация Vite для работы через OAuth2 Proxy
// В dev режиме: OAuth2-proxy (localhost:4180) -> Vite (localhost:5173)
// В prod режиме: OAuth2-proxy -> статические файлы
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        // Проксируем запросы к /api/* на бэкенд (для dev режима, когда заходим напрямую на :5173)
        // В проде через oauth2-proxy этот proxy не используется
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        }
    }
})