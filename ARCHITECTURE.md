# Архитектура системы аутентификации

## Общая схема

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ПОЛЬЗОВАТЕЛЬ                                    │
│                                 (Браузер)                                    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 │ 1. Открывает http://localhost:5173
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React + Vite)                             │
│                            localhost:5173                                    │
│                                                                              │
│  • Проверяет аутентификацию через Authentik                                 │
│  • Использует OAuth 2.0 + PKCE                                              │
│  • НЕ хранит refresh token                                                  │
│  • Получает userinfo от Authentik                                           │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 │ 2. OAuth flow / API requests
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTIK (Identity Proxy)                            │
│                            localhost:9000                                    │
│                                                                              │
│  Функции:                                                                   │
│  ✓ OAuth 2.0 / OpenID Connect сервер                                       │
│  ✓ Прокси для бэкенда                                                       │
│  ✓ Хранит refresh tokens                                                    │
│  ✓ Управляет сессиями                                                       │
│  ✓ Инжектирует заголовки в запросы к бэкенду:                              │
│    - X-Authentik-Username                                                   │
│    - X-Authentik-Email                                                      │
│    - X-Authentik-Groups                                                     │
│    - X-Authentik-Uid                                                        │
│                                                                              │
│  Компоненты:                                                                │
│  • authentik_server (порт 9000, 9443)                                       │
│  • authentik_worker                                                         │
│  • authentik_db (PostgreSQL на порту 5434)                                  │
│  • authentik_redis                                                          │
└──────────────┬──────────────────────────────────┬───────────────────────────┘
               │                                  │
               │ 3. Федерация                    │ 4. Прокси запросы
               │ (OAuth Source)                   │ с инжектированными
               ▼                                  │ заголовками
┌─────────────────────────────────┐              ▼
│      KEYCLOAK (IdP)             │   ┌─────────────────────────────────┐
│      localhost:8080             │   │   BACKEND (FastAPI)             │
│                                 │   │   localhost:3001                │
│  Функции:                       │   │                                 │
│  ✓ Identity Provider            │   │  Функции:                       │
│  ✓ Управление пользователями    │   │  ✓ Читает заголовки от          │
│  ✓ Управление ролями            │   │    Authentik                    │
│  ✓ Интеграция с LDAP            │   │  ✓ НЕ проверяет JWT напрямую    │
│  ✓ Выдача JWT токенов           │   │  ✓ Доверяет Authentik           │
│                                 │   │  ✓ Возвращает данные            │
│  Компоненты:                    │   │                                 │
│  • keycloak (порт 8080)         │   │  Endpoints:                     │
│  • keycloak_db (PostgreSQL      │   │  • GET /reports                 │
│    на порту 5433)               │   │  • GET /reports-jwt (debug)     │
└────────────┬────────────────────┘   └─────────────────────────────────┘
             │
             │ 5. LDAP интеграция
             ▼
┌─────────────────────────────────┐
│   OpenLDAP (User Directory)     │
│   localhost:389                 │
│                                 │
│  • Хранит пользователей         │
│  • Организационная структура    │
│  • phpLDAPadmin (порт 8081)     │
└─────────────────────────────────┘
```

## Поток аутентификации (детально)

### Первый вход пользователя

```
1. Пользователь → Frontend
   GET http://localhost:5173
   
2. Frontend проверяет аутентификацию
   GET http://localhost:9000/application/o/userinfo/
   Response: 401 Unauthorized (не залогинен)
   
3. Frontend инициирует OAuth flow
   Генерирует: state, code_verifier, code_challenge
   Redirect → http://localhost:9000/application/o/authorize/?
              client_id=bionicpro-frontend&
              redirect_uri=http://localhost:5173/callback&
              response_type=code&
              scope=openid+profile+email&
              state=<random>&
              code_challenge=<hash>&
              code_challenge_method=S256
              
4. Authentik проверяет сессию
   Пользователь не залогинен в Authentik
   Redirect → Keycloak (OAuth Source)
   
5. Keycloak показывает форму входа
   Пользователь вводит credentials
   
6. Keycloak аутентифицирует пользователя
   Проверяет в LDAP (если настроено)
   Создает сессию
   Redirect → Authentik с authorization code
   
7. Authentik обменивает code на tokens
   POST http://keycloak:8080/realms/reports-realm/protocol/openid-connect/token
   Получает: access_token, refresh_token, id_token
   Сохраняет refresh_token в своей БД
   Создает сессию пользователя
   Redirect → Frontend с authorization code
   
8. Frontend обменивает code на tokens
   POST http://localhost:9000/application/o/token/
   body: code, code_verifier, client_id, redirect_uri
   Получает: access_token (от Authentik)
   
9. Frontend получает userinfo
   GET http://localhost:9000/application/o/userinfo/
   Response: { sub, email, preferred_username, groups, ... }
   
10. Frontend показывает главную страницу
    Отображает информацию о пользователе
```

### Запрос к бэкенду

```
1. Пользователь нажимает "Вызвать GET /reports"
   
2. Frontend делает запрос
   GET http://localhost:3001/reports
   credentials: 'include' (отправляет cookies с сессией Authentik)
   
3. Authentik перехватывает запрос (Proxy Provider)
   Проверяет сессию пользователя
   Проверяет access_token
   Если токен истек → обновляет через refresh_token в Keycloak
   
4. Authentik инжектирует заголовки
   X-Authentik-Username: john.doe
   X-Authentik-Email: john.doe@example.com
   X-Authentik-Groups: admin,user
   X-Authentik-Uid: 12345
   
5. Authentik проксирует запрос к Backend
   GET http://reports_backend:3001/reports
   + инжектированные заголовки
   
6. Backend обрабатывает запрос
   Читает заголовки X-Authentik-*
   Извлекает username, email, groups
   Возвращает данные
   
7. Authentik проксирует ответ обратно
   Response → Frontend
   
8. Frontend отображает результат
```

## Безопасность

### Что НЕ хранится в браузере

- ❌ **Refresh token** - хранится только в Authentik
- ❌ **Keycloak access token** - используется только между Authentik и Keycloak
- ❌ **Client secret** - используется только в Authentik

### Что хранится в браузере

- ✅ **Authentik session cookie** - httpOnly, secure
- ✅ **Authentik access token** - короткоживущий (можно настроить TTL)

### Преимущества архитектуры

1. **Изоляция токенов**: Refresh token никогда не попадает в браузер
2. **Централизованное управление**: Authentik управляет всеми токенами
3. **Автоматическое обновление**: Authentik автоматически обновляет токены
4. **Упрощенный фронтенд**: Не нужно реализовывать логику обновления токенов
5. **Безопасный бэкенд**: Бэкенд доверяет только заголовкам от Authentik
6. **Гибкость**: Легко добавить другие IdP (Google, GitHub, SAML и т.д.)

## Конфигурация компонентов

### Frontend (bionicpro-frontend)

**Технологии**: React 18, TypeScript, Vite, TailwindCSS

**Ключевые файлы**:
- `src/App.tsx` - OAuth flow, userinfo, API запросы
- `src/main.tsx` - Entry point
- `package.json` - Зависимости (без keycloak-js)

**Переменные**:
```typescript
AUTHENTIK_URL = 'http://localhost:9000'
CLIENT_ID = 'bionicpro-frontend'
REDIRECT_URI = 'http://localhost:5173/callback'
BACKEND_URL = 'http://localhost:3001'
```

### Backend (reports_backend)

**Технологии**: FastAPI, Python 3.11+

**Ключевые файлы**:
- `main.py` - API endpoints, header extraction

**Функции**:
- `get_user_from_headers()` - Извлекает данные из заголовков Authentik
- `verify_jwt()` - Опциональная проверка JWT (для отладки)

**Endpoints**:
- `GET /reports` - Основной endpoint (использует заголовки Authentik)
- `GET /reports-jwt` - Debug endpoint (проверяет JWT напрямую)

### Authentik

**Компоненты**:
- **OAuth Source**: Подключение к Keycloak
- **OAuth2 Provider**: Для фронтенда
- **Proxy Provider**: Для бэкенда
- **Application**: BionicPro Frontend
- **Application**: BionicPro Backend

### Keycloak

**Компоненты**:
- **Realm**: reports-realm
- **Client**: authentik-client (для Authentik)
- **Client**: reports-api (опционально, для прямой интеграции)
- **Users**: Пользователи системы
- **Roles**: Роли пользователей

## Масштабирование

### Горизонтальное масштабирование

- **Frontend**: Статические файлы → CDN
- **Backend**: Несколько инстансов за load balancer
- **Authentik**: Несколько worker'ов, shared Redis/PostgreSQL
- **Keycloak**: Кластер с shared PostgreSQL

### Вертикальное масштабирование

- **PostgreSQL**: Увеличение ресурсов для БД
- **Redis**: Увеличение памяти для кеша сессий

## Мониторинг

### Метрики для отслеживания

- Количество активных сессий в Authentik
- Время ответа Keycloak
- Количество обновлений токенов
- Ошибки аутентификации
- Latency запросов к бэкенду

### Логи

- **Authentik**: `/var/log/authentik/`
- **Keycloak**: Логи в stdout контейнера
- **Backend**: Python logging в stdout

## Дальнейшее развитие

### Возможные улучшения

1. **HTTPS**: Настроить TLS для всех сервисов
2. **Rate limiting**: Ограничение запросов в Authentik
3. **MFA**: Двухфакторная аутентификация в Keycloak/Authentik
4. **Audit logs**: Логирование всех действий пользователей
5. **RBAC**: Детальное управление доступом на уровне бэкенда
6. **API Gateway**: Kong/Traefik перед всеми сервисами
7. **Service Mesh**: Istio для управления трафиком
