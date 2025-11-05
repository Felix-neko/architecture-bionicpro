// Упрощенное приложение для работы через oauth2-proxy
// oauth2-proxy управляет всей авторизацией, фронтенд только отображает данные
import React, { useState, useEffect } from 'react'

// Интерфейс для ответа от бэкенда /reports
interface ReportsResponse {
  payload: any;
}

// Интерфейс для состояния ответа бэкенда
interface BackendResponse {
  status: number;
  data: ReportsResponse | null;
  error: string | null;
}

// Интерфейс для информации о пользователе из заголовков oauth2-proxy
interface UserInfo {
  email?: string;
  user?: string;
  preferredUsername?: string;
}

export default function App() {
  // Состояние: информация о пользователе из заголовков
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  
  // Состояние: ответ от бэкенда /reports
  const [backendResponse, setBackendResponse] = useState<BackendResponse | null>(null);
  
  // Состояние: загружается ли запрос к бэкенду
  const [loadingBackend, setLoadingBackend] = useState(false);
  
  // Состояние: загружается ли информация о пользователе
  const [loadingUser, setLoadingUser] = useState(true);

  // При загрузке компонента получаем информацию о пользователе
  useEffect(() => {
    // OAuth2-proxy автоматически управляет авторизацией
    // Если пользователь не авторизован, он будет редиректнут на страницу входа
    // Если авторизован, мы просто показываем приложение
    setLoadingUser(false);
    // Можно попробовать получить информацию из заголовков, но это опционально
    setUserInfo({ email: 'Authorized User' });
  }, []);

  // Функция для вызова бэкенда /reports
  const fetchReports = async () => {
    setLoadingBackend(true);
    setBackendResponse(null);

    try {
      // Вызываем бэкенд через oauth2-proxy
      // oauth2-proxy автоматически добавит Authorization заголовок с access token
      const response = await fetch('/api/reports', {
        method: 'GET',
        credentials: 'include', // Включаем cookies для аутентификации
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const status = response.status;
      let data = null;
      let error = null;
      
      if (response.ok) {
        data = await response.json();
      } else {
        error = await response.text();
      }

      setBackendResponse({ status, data, error });
    } catch (err) {
      console.error('Backend request failed:', err);
      setBackendResponse({
        status: 0,
        data: null,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoadingBackend(false);
    }
  };

  // Функция для выхода из системы
  const handleLogout = () => {
    // oauth2-proxy предоставляет эндпоинт /oauth2/sign_out для выхода
    window.location.href = '/oauth2/sign_out';
  };

  // Показываем индикатор загрузки при получении информации о пользователе
  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  // Если нет информации о пользователе, показываем сообщение
  // (на практике oauth2-proxy должен автоматически редиректнуть на страницу входа)
  if (!userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow">
          <h1 className="text-2xl font-bold mb-4">Требуется авторизация</h1>
          <p className="mb-6 text-gray-600">
            Для доступа к приложению необходимо авторизоваться
          </p>
          <a
            href="/oauth2/start"
            className="block w-full text-center bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition"
          >
            Войти
          </a>
        </div>
      </div>
    );
  }

  // Пользователь авторизован - показываем главную страницу
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Заголовок и кнопка выхода */}
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-green-600">
              ✓ Вы авторизованы через OAuth2 Proxy!
            </h1>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition"
            >
              Выйти
            </button>
          </div>
        </div>

        {/* Блок с информацией о пользователе */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">Информация о пользователе</h2>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="font-semibold">Email:</div>
              <div>{userInfo.email || 'N/A'}</div>
              
              <div className="font-semibold">User:</div>
              <div>{userInfo.user || userInfo.preferredUsername || 'N/A'}</div>
            </div>
            
            {/* Полный JSON пользователя */}
            <details className="mt-4">
              <summary className="cursor-pointer font-semibold text-blue-600 hover:text-blue-800">
                Показать полную информацию (JSON)
              </summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded-lg overflow-auto text-xs">
                {JSON.stringify(userInfo, null, 2)}
              </pre>
            </details>
          </div>
        </div>

        {/* Блок для вызова бэкенда */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">Запрос к бэкенду</h2>
          
          <p className="text-sm text-gray-600 mb-4">
            OAuth2 Proxy автоматически добавит Authorization заголовок с access token
          </p>
          
          {/* Кнопка для вызова /reports */}
          <button
            onClick={fetchReports}
            disabled={loadingBackend}
            className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loadingBackend ? 'Загрузка...' : 'Вызвать GET /api/reports'}
          </button>

          {/* Отображение результата запроса */}
          {backendResponse && (
            <div className="mt-4">
              {/* HTTP статус код */}
              <div className="mb-2">
                <span className="font-semibold">HTTP статус код: </span>
                <span className={`font-mono ${
                  backendResponse.status >= 200 && backendResponse.status < 300
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {backendResponse.status}
                </span>
              </div>

              {/* Данные ответа или ошибка */}
              {backendResponse.data ? (
                <div>
                  <div className="font-semibold mb-2">Ответ от сервера:</div>
                  <pre className="p-4 bg-gray-100 rounded-lg overflow-auto text-sm">
                    {JSON.stringify(backendResponse.data, null, 2)}
                  </pre>
                </div>
              ) : backendResponse.error ? (
                <div>
                  <div className="font-semibold mb-2 text-red-600">Ошибка:</div>
                  <pre className="p-4 bg-red-50 rounded-lg overflow-auto text-sm text-red-800">
                    {backendResponse.error}
                  </pre>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
