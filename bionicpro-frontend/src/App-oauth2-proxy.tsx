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

// Интерфейс для информации о пользователе из oauth2-proxy userinfo endpoint
interface UserInfo {
  email?: string;
  user?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  realm_roles?: string[];
  [key: string]: any; // Для дополнительных полей
}

// Интерфейс для декодированного JWT токена
interface DecodedJWT {
  [key: string]: any;
}

export default function App() {
  // Состояние: информация о пользователе из заголовков
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  
  // Состояние: декодированный JWT access token
  const [decodedToken, setDecodedToken] = useState<DecodedJWT | null>(null);
  
  // Состояние: ответ от бэкенда /reports
  const [backendResponse, setBackendResponse] = useState<BackendResponse | null>(null);
  
  // Состояние: загружается ли запрос к бэкенду
  const [loadingBackend, setLoadingBackend] = useState(false);
  
  // Состояние: загружается ли информация о пользователе
  const [loadingUser, setLoadingUser] = useState(true);

  // При загрузке компонента получаем информацию о пользователе
  useEffect(() => {
    fetchUserInfo();
    fetchAccessToken();
  }, []);

  // Функция для декодирования JWT токена (без проверки подписи)
  const decodeJWT = (token: string): DecodedJWT | null => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      // Декодируем payload (вторая часть токена)
      const payload = parts[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return decoded;
    } catch (err) {
      console.error('Failed to decode JWT:', err);
      return null;
    }
  };

  // Функция для получения access token из cookie или заголовков
  const fetchAccessToken = async () => {
    try {
      // OAuth2-proxy может передавать токен через:
      // 1. Cookie _oauth2_proxy (зашифрованная, недоступна для JS)
      // 2. Заголовок X-Forwarded-Access-Token (если настроено)
      
      // Попробуем получить токен, сделав запрос к любому endpoint
      // OAuth2-proxy может добавить токен в ответ
      const response = await fetch('/oauth2/userinfo', {
        credentials: 'include',
      });

      // Проверяем заголовки ответа на наличие токена
      const accessToken = response.headers.get('X-Forwarded-Access-Token');
      
      if (accessToken) {
        const decoded = decodeJWT(accessToken);
        setDecodedToken(decoded);
        console.log('Access token found in X-Forwarded-Access-Token header');
        return;
      }

      // Если токен не найден в заголовках, попробуем получить из userinfo
      // OAuth2-proxy может включать токен в ответ userinfo
      if (response.ok) {
        const data = await response.json();
        // Проверяем, есть ли поле access_token в ответе
        if (data.access_token) {
          const decoded = decodeJWT(data.access_token);
          setDecodedToken(decoded);
          console.log('Access token found in userinfo response');
          return;
        }
      }

      console.log('Access token not found - OAuth2-proxy stores it in HTTP-only cookie');
      // Токен хранится в HTTP-only cookie и недоступен для JavaScript
      // Это нормально и безопасно
    } catch (err) {
      console.error('Failed to fetch access token:', err);
    }
  };

  // Функция для получения информации о пользователе из oauth2-proxy
  const fetchUserInfo = async () => {
    try {
      // oauth2-proxy предоставляет эндпоинт /oauth2/userinfo для получения информации о пользователе
      const response = await fetch('http://localhost:4180/oauth2/userinfo', {
        credentials: 'include', // Включаем cookies
      });

      if (response.ok) {
        const data = await response.json();
        setUserInfo(data);
      } else if (response.status === 401 || response.status === 403) {
        // Если не авторизованы, сразу редиректим на oauth2-proxy для авторизации
        console.log('User not authenticated, redirecting to oauth2-proxy');
        window.location.href = 'http://localhost:4180/oauth2/sign_in';
      } else {
        console.error('Failed to fetch user info:', response.status);
        // В случае других ошибок тоже редиректим
        window.location.href = 'http://localhost:4180/oauth2/sign_in';
      }
    } catch (err) {
      console.error('Failed to fetch user info:', err);
      // В случае ошибки сети тоже редиректим
      window.location.href = 'http://localhost:4180/oauth2/sign_in';
    } finally {
      setLoadingUser(false);
    }
  };

  // Функция для вызова бэкенда /reports
  const fetchReports = async () => {
    setLoadingBackend(true);
    setBackendResponse(null);

    try {
      // Вызываем бэкенд через vite proxy (/api/reports -> localhost:3001/reports)
      // OAuth2-proxy передаст Authorization заголовок через прокси
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
    window.location.href = 'http://localhost:4180/oauth2/sign_out';
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

        {/* Блок с информацией о пользователе из /oauth2/userinfo */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">Информация о пользователе из /oauth2/userinfo</h2>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="font-semibold">Email:</div>
              <div>{userInfo.email || 'N/A'}</div>
              
              <div className="font-semibold">Preferred Username:</div>
              <div>{userInfo.preferred_username || userInfo.user || 'N/A'}</div>
              
              <div className="font-semibold">First Name:</div>
              <div>{userInfo.given_name || 'N/A'}</div>
              
              <div className="font-semibold">Last Name:</div>
              <div>{userInfo.family_name || 'N/A'}</div>
              
              <div className="font-semibold">Realm Roles:</div>
              <div>{
                userInfo.realm_roles ? userInfo.realm_roles.join(', ') :
                userInfo.roles ? (Array.isArray(userInfo.roles) ? userInfo.roles.join(', ') : userInfo.roles) :
                userInfo.realm_access?.roles ? userInfo.realm_access.roles.join(', ') :
                'N/A (роли доступны в JWT access token, но не в userinfo)'
              }</div>
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

        {/* Блок с информацией об Access Token */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">Access Token</h2>
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2">
                <span className="font-semibold">Где хранится Access Token:</span>
              </p>
              <p className="text-sm text-gray-600">
                OAuth2 Proxy хранит access token в зашифрованной HTTP-only cookie с именем <code className="bg-gray-200 px-1 rounded">_oauth2_proxy</code>.
                Эта cookie автоматически отправляется с каждым запросом к серверу.
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Когда фронтенд делает запрос к бэкенду через OAuth2 Proxy, прокси автоматически:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 ml-4 mt-1">
                <li>Расшифровывает cookie</li>
                <li>Извлекает access token</li>
                <li>Добавляет заголовок <code className="bg-gray-200 px-1 rounded">X-Forwarded-Access-Token</code> или <code className="bg-gray-200 px-1 rounded">Authorization: Bearer</code></li>
                <li>Проксирует запрос на бэкенд</li>
              </ul>
            </div>
            
            {decodedToken ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">✓ Декодированный Access Token JWT:</span>
                </p>
                <p className="text-xs text-gray-600 mb-2">
                  Токен получен из ответа OAuth2 Proxy (проверялись заголовки <code className="bg-gray-200 px-1 rounded">X-Forwarded-Access-Token</code> 
                  и поле <code className="bg-gray-200 px-1 rounded">access_token</code> в userinfo).
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer font-semibold text-green-700 hover:text-green-900 text-sm">
                    Показать содержимое JWT токена
                  </summary>
                  <pre className="mt-2 p-3 bg-white rounded text-xs overflow-auto max-h-96">
                    {JSON.stringify(decodedToken, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">ℹ️ Access Token недоступен для JavaScript:</span>
                </p>
                <p className="text-xs text-gray-600">
                  OAuth2 Proxy не передает access token в заголовках ответа или в userinfo. 
                  Токен хранится в зашифрованной HTTP-only cookie <code className="bg-gray-200 px-1 rounded">_oauth2_proxy</code> 
                  и автоматически используется OAuth2 Proxy при проксировании запросов к бэкенду.
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  Это безопасный подход, так как токен защищен от XSS-атак и недоступен для JavaScript кода.
                </p>
              </div>
            )}
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">⚠️ Безопасность:</span> Фронтенд не имеет прямого доступа к access token,
                так как он хранится в HTTP-only cookie. Это защищает от XSS-атак.
              </p>
            </div>
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
            {loadingBackend ? 'Загрузка...' : 'Вызвать GET /reports'}
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
                  <div className="font-semibold mb-2">Содержимое JWT-токена, полученного бэкендом:</div>
                  <div className="mb-2 text-sm text-gray-600">
                    Это данные из JWT access token, который OAuth2 Proxy передал в заголовке Authorization
                  </div>
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
