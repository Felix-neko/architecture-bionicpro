// Упрощенный main.tsx для работы через oauth2-proxy
// OAuth2 Proxy управляет всей авторизацией, поэтому Keycloak провайдер не нужен

// Импортируем библиотеку React
import React from 'react'
// Импортируем функцию для создания корневого элемента React 18
import { createRoot } from 'react-dom/client'
// Импортируем главный компонент приложения для работы через OAuth2 Proxy
import App from './App-oauth2-proxy'
// Импортируем глобальные стили
import './index.css'

// Получаем корневой элемент DOM
const container = document.getElementById('root')!

// Создаем корневой React элемент и рендерим приложение
// Без Keycloak провайдера - oauth2-proxy управляет авторизацией
createRoot(container).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)