// Фронтенд для работы с Authentik Proxy Provider
// Proxy Outpost автоматически проверяет аутентификацию и добавляет заголовки
import React, { useState, useEffect } from 'react'

const BACKEND_URL = 'http://localhost:3001'

interface UserInfo {
  username: string;
  email?: string;
  name?: string;
  groups?: string[];
}

interface BackendResponse {
  status: number;
  data: any | null;
  error: string | null;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [backendResponse, setBackendResponse] = useState<BackendResponse | null>(null);
  const [loadingBackend, setLoadingBackend] = useState(false);

  /**
   * Проверяем при загрузке, аутентифицирован ли пользователь
   * Если мы здесь - значит Proxy Outpost пропустил нас, мы аутентифицированы
   */
  useEffect(() => {
    // Если мы загрузились - значит Proxy Outpost нас пропустил
    // Можем сразу считать, что аутентифицированы
    setIsAuthenticated(true);
    setLoading(false);
    
    // Попробуем получить информацию о пользователе из мета-тегов или API
    fetchUserInfo();
  }, []);

  /**
   * Получаем информацию о пользователе
   */
  const fetchUserInfo = async () => {
    try {
      // Делаем запрос к бэкенду, который получит заголовки от Authentik
      const response = await fetch(`${BACKEND_URL}/reports`, {
        credentials: 'include', // Важно! Отправляем cookies
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[UserInfo] Received:', data);
        
        setUserInfo({
          username: data.user.username,
          email: data.user.email,
          groups: data.user.groups,
        });
      }
    } catch (error) {
      console.error('[UserInfo] Error:', error);
    }
  };

  /**
   * Выход из системы
   */
  const handleLogout = () => {
    // Редиректим на Authentik logout endpoint
    // Proxy Outpost автоматически обработает logout
    window.location.href = '/outpost.goauthentik.io/sign_out';
  };

  /**
   * Вызов бэкенда
   */
  const fetchReports = async () => {
    setLoadingBackend(true);
    setBackendResponse(null);

    try {
      console.log('[Backend] Calling /reports...');
      
      const response = await fetch(`${BACKEND_URL}/reports`, {
        credentials: 'include',
      });

      console.log('[Backend] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[Backend] Response data:', data);
        
        setBackendResponse({
          status: response.status,
          data: data,
          error: null,
        });
      } else {
        const errorText = await response.text();
        console.error('[Backend] Error response:', errorText);
        
        setBackendResponse({
          status: response.status,
          data: null,
          error: errorText || `HTTP ${response.status}`,
        });
      }
    } catch (error) {
      console.error('[Backend] Fetch error:', error);
      setBackendResponse({
        status: 0,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoadingBackend(false);
    }
  };

  // Показываем индикатор загрузки
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Пользователь аутентифицирован - показываем основной интерфейс
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Заголовок с информацией о пользователе */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                BionicPro
              </h1>
              <p className="text-green-600 font-semibold">
                ✓ Вы авторизованы
              </p>
              {userInfo && (
                <div className="mt-3 text-sm text-gray-600">
                  <p><strong>Username:</strong> {userInfo.username}</p>
                  {userInfo.email && <p><strong>Email:</strong> {userInfo.email}</p>}
                  {userInfo.groups && userInfo.groups.length > 0 && (
                    <p><strong>Группы:</strong> {userInfo.groups.join(', ')}</p>
                  )}
                </div>
              )}
            </div>
            
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 ease-in-out shadow-md"
            >
              Выйти
            </button>
          </div>
        </div>

        {/* Кнопка для вызова бэкенда */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Тестирование бэкенда
          </h2>
          
          <button
            onClick={fetchReports}
            disabled={loadingBackend}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 ease-in-out shadow-md"
          >
            {loadingBackend ? 'Загрузка...' : 'Вызвать GET /reports'}
          </button>

          {/* Отображение ответа от бэкенда */}
          {backendResponse && (
            <div className="mt-4">
              <h3 className="font-semibold text-gray-700 mb-2">
                Ответ от бэкенда:
              </h3>
              
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Status:</strong> {backendResponse.status}
                </p>
                
                {backendResponse.error ? (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-red-800 font-semibold">Ошибка:</p>
                    <p className="text-red-600 text-sm mt-1">{backendResponse.error}</p>
                  </div>
                ) : backendResponse.data ? (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Message:</strong> {backendResponse.data.message}
                    </p>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                      <p className="text-blue-800 font-semibold mb-2">Данные пользователя:</p>
                      <pre className="text-xs text-blue-900 overflow-x-auto bg-gray-100 p-2 rounded">
                        {JSON.stringify(backendResponse.data.user, null, 2)}
                      </pre>
                    </div>
                    
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <p className="text-green-800 font-semibold mb-2">Отчеты:</p>
                      <pre className="text-xs text-green-900 overflow-x-auto bg-gray-100 p-2 rounded">
                        {JSON.stringify(backendResponse.data.reports, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Информация о системе */}
        <div className="bg-white rounded-lg shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Информация о системе
          </h2>
          
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Режим аутентификации:</strong> Authentik Proxy Provider (Session-based)</p>
            <p><strong>Proxy Outpost:</strong> http://localhost:8888</p>
            <p><strong>Backend URL:</strong> {BACKEND_URL}</p>
            <p><strong>Описание:</strong> Authentik Proxy Outpost проксирует запросы к фронтенду и добавляет заголовки X-authentik-*</p>
          </div>
        </div>
      </div>
    </div>
  );
}
