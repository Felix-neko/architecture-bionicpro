// Импортируем React и хуки для управления состоянием компонента
import React, { useState, useEffect } from 'react'

// Конфигурация Authentik OAuth
const AUTHENTIK_URL = 'http://localhost:9000'
const CLIENT_ID = 'bionicpro-frontend'
const REDIRECT_URI = 'http://localhost:5173/callback'
const BACKEND_URL = 'http://localhost:3001'

// Интерфейс для ответа от бэкенда /reports
interface ReportsResponse {
  message: string;
  user: {
    username: string;
    email: string | null;
    groups: string[];
    uid: string;
    authenticated_via: string;
  };
  reports: Array<{
    id: number;
    name: string;
    status: string;
  }>;
}

// Интерфейс для состояния ответа бэкенда
interface BackendResponse {
  status: number;
  data: ReportsResponse | null;
  error: string | null;
}

// Интерфейс для информации о пользователе из Authentik
interface UserInfo {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  groups?: string[];
  [key: string]: any;
}

/**
 * Генерирует случайную строку для PKCE
 */
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Создает SHA256 хеш и кодирует в base64url для PKCE
 */
async function sha256(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64urlencode(hash);
}

/**
 * Кодирует ArrayBuffer в base64url
 */
function base64urlencode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  bytes.forEach((byte) => {
    str += String.fromCharCode(byte);
  });
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export default function App() {
  // Состояние: аутентифицирован ли пользователь
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  // Состояние: загрузка проверки аутентификации
  const [loading, setLoading] = useState<boolean>(true);
  // Состояние: информация о пользователе
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  // Состояние: access token
  const [accessToken, setAccessToken] = useState<string | null>(null);
  // Состояние: ответ от бэкенда /reports
  const [backendResponse, setBackendResponse] = useState<BackendResponse | null>(null);
  // Состояние: загружается ли запрос к бэкенду
  const [loadingBackend, setLoadingBackend] = useState(false);

  /**
   * Проверяем при загрузке, есть ли OAuth callback в URL
   * [UPDATE_MARKER_v2]
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state) {
      // Обрабатываем OAuth callback
      handleOAuthCallback(code, state);
    } else {
      // Проверяем, есть ли сохраненная сессия
      checkAuthentication();
    }
  }, []);

  /**
   * Проверяет, аутентифицирован ли пользователь
   */
  const checkAuthentication = async () => {
    console.log('[Auth] Checking authentication...');
    try {
      // Проверяем, есть ли access token
      const token = accessToken || localStorage.getItem('access_token');
      
      if (!token) {
        console.log('[Auth] No access token found');
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      // Пытаемся получить информацию о пользователе из Authentik
      const response = await fetch(`${AUTHENTIK_URL}/application/o/userinfo/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('[Auth] Userinfo response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[Auth] User authenticated:', { username: data.preferred_username || data.name });
        setUserInfo(data);
        setIsAuthenticated(true);
        setAccessToken(token);
      } else {
        console.log('[Auth] User not authenticated');
        setIsAuthenticated(false);
        localStorage.removeItem('access_token');
      }
    } catch (error) {
      console.error('[Auth] Error checking authentication:', error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Обрабатывает OAuth callback после редиректа из Authentik
   */
  const handleOAuthCallback = async (code: string, state: string) => {
    console.log('[OAuth] Starting callback handling', { code: code.substring(0, 20) + '...', state: state.substring(0, 20) + '...' });
    
    try {
      // Проверяем state для защиты от CSRF
      const savedState = sessionStorage.getItem('oauth_state');
      console.log('[OAuth] Checking state', { received: state.substring(0, 20) + '...', saved: savedState?.substring(0, 20) + '...' });
      
      if (state !== savedState) {
        console.error('[OAuth] State mismatch!', { received: state, saved: savedState });
        throw new Error('Invalid state parameter');
      }

      // Получаем code_verifier для PKCE
      const codeVerifier = sessionStorage.getItem('code_verifier');
      if (!codeVerifier) {
        console.error('[OAuth] Missing code_verifier in sessionStorage');
        throw new Error('Missing code verifier');
      }
      console.log('[OAuth] Code verifier found');

      // Обмениваем authorization code на токены
      console.log('[OAuth] Exchanging code for tokens...');
      const tokenResponse = await fetch(`${AUTHENTIK_URL}/application/o/token/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          code_verifier: codeVerifier,
        }),
        credentials: 'include',
      });

      console.log('[OAuth] Token response status:', tokenResponse.status);
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('[OAuth] Token exchange failed:', errorText);
        throw new Error(`Failed to exchange code for tokens: ${tokenResponse.status} ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      console.log('[OAuth] Token exchange successful', { hasAccessToken: !!tokenData.access_token });

      // Сохраняем access token
      if (tokenData.access_token) {
        localStorage.setItem('access_token', tokenData.access_token);
        setAccessToken(tokenData.access_token);
        console.log('[OAuth] Access token saved');
      }

      // Очищаем временные данные
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('code_verifier');

      // Очищаем URL от параметров
      window.history.replaceState({}, document.title, window.location.pathname);

      // Проверяем аутентификацию
      console.log('[OAuth] Checking authentication...');
      await checkAuthentication();
      console.log('[OAuth] Callback handling complete');
    } catch (error) {
      console.error('[OAuth] Callback error:', error);
      setLoading(false);
    }
  };

  /**
   * Инициирует OAuth flow для входа
   */
  const handleLogin = async () => {
    console.log('[Login] Starting OAuth flow');
    
    // Генерируем state для защиты от CSRF
    const state = generateRandomString(32);
    sessionStorage.setItem('oauth_state', state);
    console.log('[Login] Saved oauth_state to sessionStorage');

    // Генерируем code_verifier и code_challenge для PKCE
    const codeVerifier = generateRandomString(128);
    sessionStorage.setItem('code_verifier', codeVerifier);
    console.log('[Login] Saved code_verifier to sessionStorage');
    
    const codeChallenge = await sha256(codeVerifier);
    console.log('[Login] Generated code_challenge');

    // Формируем URL для авторизации
    const authUrl = new URL(`${AUTHENTIK_URL}/application/o/authorize/`);
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'openid profile email');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');

    console.log('[Login] Redirecting to:', authUrl.toString());
    
    // Перенаправляем пользователя на страницу авторизации Authentik
    window.location.href = authUrl.toString();
  };

  /**
   * Выполняет выход из системы
   */
  const handleLogout = async () => {
    try {
      // Вызываем endpoint logout в Authentik
      await fetch(`${AUTHENTIK_URL}/application/o/revoke/`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsAuthenticated(false);
      setUserInfo(null);
      setAccessToken(null);
      localStorage.removeItem('access_token');
      // Перенаправляем на страницу выхода Authentik
      window.location.href = `${AUTHENTIK_URL}/if/flow/default-invalidation-flow/`;
    }
  };

  /**
   * Функция для вызова бэкенда /reports
   * [UPDATE_MARKER_v3]
   */
  const fetchReports = async () => {
    setLoadingBackend(true);
    setBackendResponse(null);

    try {
      const token = accessToken || localStorage.getItem('access_token');
      
      // Выполняем GET запрос к бэкенду с JWT токеном
      // Используем /reports-jwt endpoint, который принимает Bearer токены
      const response = await fetch(`${BACKEND_URL}/reports-jwt`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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

  // Показываем индикатор загрузки
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  // Если пользователь не аутентифицирован, показываем экран входа
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow">
          <h1 className="text-2xl font-bold mb-4">Вход в систему</h1>
          <p className="mb-6 text-gray-600">
            Для доступа к приложению необходимо авторизоваться через Authentik
          </p>
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition"
          >
            Войти через Authentik
          </button>
          <p className="mt-4 text-sm text-gray-500">
            Authentik использует Keycloak как провайдер идентификации
          </p>
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
              ✓ Вы авторизованы!
            </h1>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition"
            >
              Выйти
            </button>
          </div>
        </div>

        {/* Блок с информацией о пользователе из Authentik */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">Информация о пользователе (из Authentik)</h2>
          {userInfo && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-semibold">Пользователь:</div>
                <div>{userInfo.preferred_username || userInfo.name || 'N/A'}</div>

                <div className="font-semibold">Email:</div>
                <div>{userInfo.email || 'N/A'}</div>

                <div className="font-semibold">Subject (ID):</div>
                <div className="break-all">{userInfo.sub}</div>

                <div className="font-semibold">Группы/Роли:</div>
                <div>{userInfo.groups?.join(', ') || 'N/A'}</div>
              </div>

              {/* Полный JSON информации о пользователе */}
              <details className="mt-4">
                <summary className="cursor-pointer font-semibold text-blue-600 hover:text-blue-800">
                  Показать полную информацию (JSON)
                </summary>
                <pre className="mt-2 p-4 bg-gray-100 rounded-lg overflow-auto text-xs">
                  {JSON.stringify(userInfo, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* Блок для вызова бэкенда */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">Запрос к бэкенду</h2>

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
              <div className="mb-2">
                <span className="font-semibold">HTTP статус код: </span>
                <span
                  className={`font-mono ${
                    backendResponse.status >= 200 && backendResponse.status < 300
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {backendResponse.status}
                </span>
              </div>

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