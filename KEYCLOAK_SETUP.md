# Инструкция по настройке и запуску системы с Keycloak

## Архитектура

Система состоит из трех компонентов:
1. **Keycloak** - сервер авторизации (порт 8080)
2. **Backend API** - FastAPI приложение (порт 3001)
3. **Frontend** - React приложение с Vite (порт 5173)

## Протокол авторизации

Используется **OAuth 2.0 Authorization Code Flow с PKCE** (Proof Key for Code Exchange):
- PKCE обеспечивает дополнительную безопасность для публичных клиентов (SPA)
- `code_challenge_method: S256` - явно указан метод SHA-256 для PKCE
- Защита от CSRF атак через параметр `state`

## Запуск системы

### 1. Запуск Keycloak и базы данных

```bash
cd /home/felix/Projects/yandex_swa_pro/architecture-bionicpro
docker-compose up -d
```

Keycloak будет доступен по адресу: http://localhost:8080
- Логин админа: `admin`
- Пароль админа: `admin`

Realm `reports-realm` будет автоматически импортирован из `keycloak/realm-export.yaml`

### 2. Запуск Backend API

```bash
cd /home/felix/Projects/yandex_swa_pro/architecture-bionicpro/reports_backend
python main.py
```

API будет доступен по адресу: http://localhost:3001

Эндпоинт:
- `GET /reports` - возвращает декодированный JWT payload

### 3. Запуск Frontend

```bash
cd /home/felix/Projects/yandex_swa_pro/architecture-bionicpro/bionicpro-frontend

# Установка зависимостей (если еще не установлены)
npm install

# Запуск dev сервера
npm run dev
```

Frontend будет доступен по адресу: http://localhost:5173

**Используемые библиотеки для Keycloak:**
- `keycloak-js` v21.1.0 - официальная JavaScript библиотека Keycloak
- `@react-keycloak/web` v3.4.0 - React обертка для keycloak-js

## Тестовые пользователи

В realm `reports-realm` предварительно созданы следующие пользователи:

| Username   | Password     | Роль           |
|------------|--------------|----------------|
| user1      | password123  | user           |
| user2      | password123  | user           |
| admin1     | admin123     | administrator  |
| prothetic1 | prothetic123 | prothetic_user |
| prothetic2 | prothetic123 | prothetic_user |
| prothetic3 | prothetic123 | prothetic_user |

## Как работает авторизация

Приложение использует официальные библиотеки Keycloak для React:
- **keycloak-js** - основная библиотека для работы с Keycloak
- **@react-keycloak/web** - React провайдер и хуки для интеграции

### Шаг 1: Инициализация Keycloak
При загрузке приложения (`main.tsx`):
1. Создается экземпляр Keycloak с конфигурацией (URL, realm, clientId)
2. Инициализируется с параметрами:
   - `onLoad: 'check-sso'` - проверяет SSO без автоматического редиректа
   - `pkceMethod: 'S256'` - **явно указывает использование PKCE с SHA-256**
3. `ReactKeycloakProvider` оборачивает приложение и управляет состоянием авторизации

### Шаг 2: Проверка авторизации
- Компонент `App.tsx` использует хук `useKeycloak()` для доступа к состоянию
- Проверяется флаг `keycloak.authenticated`
- Если пользователь не авторизован - показывается кнопка входа

### Шаг 3: Инициация PKCE flow
При нажатии на кнопку входа вызывается `keycloak.login({ pkceMethod: 'S256' })`:
1. Библиотека **keycloak-js автоматически генерирует** `code_verifier` (43 символа)
2. Вычисляется `code_challenge = SHA256(code_verifier)` в base64url формате
3. Генерируется `state` для защиты от CSRF
4. `code_verifier` и `state` сохраняются в sessionStorage
5. Пользователь перенаправляется на Keycloak с параметрами:
   - `response_type=code`
   - `code_challenge` и `code_challenge_method=S256` (PKCE)
   - `state` (CSRF защита)

### Шаг 4: Авторизация в Keycloak
- Пользователь вводит логин и пароль на странице Keycloak
- Keycloak проверяет учетные данные
- После успешной авторизации Keycloak редиректит обратно на фронтенд с `code` и `state`

### Шаг 5: Обмен code на токены (автоматически)
Библиотека **keycloak-js автоматически**:
1. Получает `code` из URL параметров
2. Проверяет `state` для защиты от CSRF
3. Отправляет POST запрос на Keycloak token endpoint с:
   - `grant_type=authorization_code`
   - `code` (authorization code)
   - `code_verifier` (из sessionStorage для PKCE)
4. Keycloak проверяет: `SHA256(code_verifier) == code_challenge`
5. Если проверка успешна - возвращает токены:
   - `access_token` (JWT)
   - `refresh_token`
   - `id_token`

### Шаг 6: Сохранение токенов (автоматически)
- Библиотека keycloak-js сохраняет токены внутри себя
- URL очищается от параметров `code` и `state`
- Обновляется состояние `keycloak.authenticated = true`
- Показывается главная страница с информацией о пользователе

### Шаг 7: Использование токенов
- JWT токен доступен через `keycloak.token`
- Токен декодируется и отображается на странице
- При вызове `/reports` токен передается в заголовке `Authorization: Bearer <token>`
- Backend декодирует JWT и возвращает его содержимое

### Автоматическое обновление токенов
Библиотека keycloak-js автоматически обновляет токены при истечении срока действия, используя `refresh_token`.

## Конфигурация Keycloak

### Client: reports-frontend
- **Type**: Public Client (без client_secret)
- **Redirect URIs**: 
  - http://localhost:3000/*
  - http://localhost:5173/*
- **Web Origins**: 
  - http://localhost:3000
  - http://localhost:5173
- **PKCE**: Поддерживается (обязательно для публичных клиентов)

### Client: reports-api
- **Type**: Bearer-only
- **Secret**: oNwoLQdvJAvRcL89SydqCWCe5ry1jMgq
- Используется только для проверки токенов на backend

## Структура JWT токена

Access token содержит:
- `sub` - ID пользователя
- `preferred_username` - имя пользователя
- `email` - email пользователя
- `name` - полное имя
- `realm_access.roles` - роли пользователя
- `exp` - время истечения токена
- `iat` - время выдачи токена

## Безопасность

1. **PKCE** - защищает от перехвата authorization code
2. **State parameter** - защищает от CSRF атак
3. **CORS** - настроен только для localhost:3000 и localhost:5173
4. **Token expiration** - токены имеют ограниченное время жизни
5. **HTTPS** - в production обязательно использовать HTTPS

## Troubleshooting

### Ошибка "Invalid redirect_uri"
- Проверьте, что в `keycloak/realm-export.yaml` добавлен `http://localhost:5173/*`
- Перезапустите Keycloak: `docker-compose restart keycloak`

### CORS ошибки
- Убедитесь, что backend запущен с CORS middleware
- Проверьте, что origin фронтенда добавлен в `allow_origins`

### Токен не сохраняется
- Проверьте консоль браузера на ошибки
- Убедитесь, что `code_verifier` сохранен в sessionStorage
- Проверьте, что `state` совпадает

### Backend возвращает 401
- Проверьте, что токен передается в заголовке `Authorization: Bearer <token>`
- Убедитесь, что токен не истек
- Проверьте формат токена (должен быть JWT с тремя частями)

## Дополнительная информация

- Keycloak документация: https://www.keycloak.org/docs/latest/
- OAuth 2.0 PKCE: https://oauth.net/2/pkce/
- FastAPI CORS: https://fastapi.tiangolo.com/tutorial/cors/
