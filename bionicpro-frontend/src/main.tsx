// Импортируем библиотеку React
import React from 'react'
// Импортируем функцию для создания корневого элемента React 18
import { createRoot } from 'react-dom/client'
// Импортируем главный компонент приложения
import App from './App'
// Импортируем глобальные стили
import './index.css'

// Получаем корневой элемент DOM
const container = document.getElementById('root')!

// Создаем корневой React элемент и рендерим приложение
createRoot(container).render(
    <React.StrictMode>
        {/* Рендерим главный компонент приложения */}
        <App />
    </React.StrictMode>
)