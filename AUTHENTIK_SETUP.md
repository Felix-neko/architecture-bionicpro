# Настройка Authentik как прокси между фронтендом и бэкендом

## Архитектура

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Frontend   │────────▶│   Authentik  │────────▶│   Keycloak   │         │   Backend    │
│ localhost:   │         │ localhost:   │         │ localhost:   │         │ localhost:   │
│    5173      │         │    9000      │         │    8080      │         │    3001      │
└──────────────┘         └──────────────┘         └──────────────┘         └──────────────┘
                                │                                                  ▲
                                │                                                  │
                                └──────────────────────────────────────────────────┘
                                        Инжектирует заголовки с данными пользователя
```

## Описание потока аутентификации

1. **Пользователь заходит на фронтенд** (localhost:5173)
2. **Фронтенд проверяет аутентификацию** через Authentik userinfo endpoint
3. **Если не залогинен** → редирект на Authentik для OAuth авторизации
4. **Authentik перенаправляет** на Keycloak для аутентификации
5. **После успешного входа в Keycloak** → Authentik получает токены
6. **Authentik хранит** refresh token и управляет сессией
7. **Фронтенд получает** информацию о пользователе от Authentik
8. **При запросах к бэкенду** → Authentik выступает как прокси и инжектирует заголовки:
   - `X-Authentik-Username` - имя пользователя
   - `X-Authentik-Email` - email пользователя
   - `X-Authentik-Groups` - группы/роли пользователя
   - `X-Authentik-Uid` - уникальный идентификатор

## Шаг 1: Запуск сервисов

```bash
# Запускаем все сервисы
docker compose up -d

# Проверяем, что все сервисы запущены
docker compose ps
```

Сервисы будут доступны по адресам:
- **Authentik**: http://localhost:9000
- **Keycloak**: http://localhost:8080
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:5173 (запускается отдельно через npm)

## Шаг 2: Настройка Keycloak

### 2.1 Вход в Keycloak
1. Откройте http://localhost:8080
2. Войдите как администратор:
   - Username: `admin`
   - Password: `admin`

### 2.2 Создание клиента для Authentik

1. Перейдите в realm `reports-realm` (уже должен быть создан)
2. Перейдите в **Clients** → **Create client**
3. Настройте клиента:
   - **Client ID**: `authentik-client`
   - **Client Protocol**: `openid-connect`
   - **Client authentication**: `ON` (confidential client)
   - **Valid redirect URIs**: 
     - `http://localhost:9000/source/oauth/callback/keycloak/`
     - `http://localhost:9000/*`
   - **Web origins**: `http://localhost:9000`

4. Во вкладке **Credentials** скопируйте **Client Secret** (понадобится для Authentik)

### 2.3 Настройка ролей и пользователей

Убедитесь, что у вас есть пользователи с ролями в Keycloak. Если нет, создайте:

1. **Создание ролей**:
   - Перейдите в **Realm roles** → **Create role**
   - Создайте роли: `admin`, `user`, `manager` и т.д.

2. **Создание пользователя**:
   - Перейдите в **Users** → **Add user**
   - Заполните данные пользователя
   - Установите пароль во вкладке **Credentials**
   - Назначьте роли во вкладке **Role mapping**

## Шаг 3: Настройка Authentik

### 3.1 Первый вход в Authentik

1. Откройте http://localhost:9000/if/flow/initial-setup/
2. Создайте администратора или войдите с:
   - Email: `akadmin@localhost`
   - Password: `admin` (из docker-compose.yaml)

### 3.2 Создание OAuth Source для Keycloak

1. Перейдите в **Admin Interface** → **Directory** → **Federation & Social login**
2. Нажмите **Create** и выберите **OAuth Source**
3. Настройте источник:
   - **Name**: `keycloak`
   - **Slug**: `keycloak`
   - **Provider type**: `OpenID Connect`
   - **Consumer key**: `authentik-client` (Client ID из Keycloak)
   - **Consumer secret**: `<Client Secret из Keycloak>`
   - **OIDC Well-known URL**: `http://keycloak:8080/realms/reports-realm/.well-known/openid-configuration`
     - ⚠️ **Важно**: Используйте `keycloak` (имя сервиса в Docker), а не `localhost`
   - **OIDC JWKS URL**: `http://keycloak:8080/realms/reports-realm/protocol/openid-connect/certs`

4. Нажмите **Save**

### 3.3 Создание Application для фронтенда

1. Перейдите в **Applications** → **Applications**
2. Нажмите **Create**
3. Настройте приложение:
   - **Name**: `BionicPro Frontend`
   - **Slug**: `bionicpro-frontend`
   - **Provider**: Создайте новый **OAuth2/OpenID Provider**

### 3.4 Создание OAuth2/OpenID Provider

1. При создании приложения нажмите **Create Provider**
2. Выберите **OAuth2/OpenID Provider**
3. Настройте провайдера:
   - **Name**: `BionicPro Frontend Provider`
   - **Authorization flow**: Выберите default flow (обычно `default-authentication-flow`)
   - **Client type**: `Public`
   - **Client ID**: `bionicpro-frontend`
   - **Redirect URIs**: 
     ```
     http://localhost:5173/callback
     http://localhost:5173/*
     ```
   - **Signing Key**: Выберите автоматически сгенерированный ключ
   - **Subject mode**: `Based on the User's hashed ID`
   - **Include claims in id_token**: `ON`
   - **Scopes**: `openid`, `profile`, `email`

4. Нажмите **Finish**

### 3.5 Создание Proxy Provider для бэкенда

1. Перейдите в **Applications** → **Providers**
2. Нажмите **Create** → **Proxy Provider**
3. Настройте провайдера:
   - **Name**: `BionicPro Backend Proxy`
   - **Authorization flow**: Выберите default flow
   - **External host**: `http://localhost:3001`
   - **Internal host**: `http://reports_backend:3001`
     - ⚠️ **Важно**: Если бэкенд в Docker, используйте имя сервиса
   - **Mode**: `Forward auth (single application)`
   - **Token validity**: `hours=24`

4. В разделе **Advanced protocol settings**:
   - **Send HTTP-Basic Username Key**: `X-Authentik-Username`
   - **Send HTTP-Basic Password Key**: (оставьте пустым)
   - **Additional scopes**: `openid profile email`

5. Нажмите **Create**

### 3.6 Создание Application для бэкенда

1. Перейдите в **Applications** → **Applications**
2. Нажмите **Create**
3. Настройте приложение:
   - **Name**: `BionicPro Backend`
   - **Slug**: `bionicpro-backend`
   - **Provider**: Выберите созданный `BionicPro Backend Proxy`
   - **Launch URL**: `http://localhost:3001`

4. Нажмите **Create**

### 3.7 Настройка Outpost для прокси

1. Перейдите в **Applications** → **Outposts**
2. Выберите **authentik Embedded Outpost** или создайте новый
3. Добавьте приложение `BionicPro Backend` к этому Outpost
4. Убедитесь, что Outpost запущен

## Шаг 4: Настройка фронтенда

Фронтенд уже настроен в `bionicpro-frontend/src/App.tsx`:

```typescript
const AUTHENTIK_URL = 'http://localhost:9000'
const CLIENT_ID = 'bionicpro-frontend'
const REDIRECT_URI = 'http://localhost:5173/callback'
```

Установите зависимости и запустите:

```bash
cd bionicpro-frontend
npm install
npm run dev
```

## Шаг 5: Запуск бэкенда

Бэкенд уже настроен для приема заголовков от Authentik:

```bash
cd reports_backend
python main.py
```

Или используйте uvicorn:

```bash
uvicorn reports_backend.main:app --host 0.0.0.0 --port 3001
```

## Шаг 6: Тестирование

1. Откройте http://localhost:5173
2. Нажмите **"Войти через Authentik"**
3. Вы будете перенаправлены на Authentik
4. Authentik перенаправит вас на Keycloak
5. Войдите в Keycloak с вашими учетными данными
6. После успешного входа вы вернетесь на фронтенд
7. Вы увидите информацию о пользователе из Authentik
8. Нажмите **"Вызвать GET /reports"** для проверки запроса к бэкенду
9. Бэкенд получит заголовки от Authentik с информацией о пользователе

## Ответы на вопросы

### Может ли фронтенд узнать username и роли пользователя?

**Да!** Фронтенд может получить эту информацию двумя способами:

#### Способ 1: Через Authentik UserInfo endpoint (реализовано)

Фронтенд вызывает `http://localhost:9000/application/o/userinfo/` с cookies и получает:

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "preferred_username": "username",
  "name": "Full Name",
  "groups": ["admin", "user"]
}
```

#### Способ 2: Через бэкенд (опционально)

Бэкенд получает заголовки от Authentik:
- `X-Authentik-Username`: имя пользователя
- `X-Authentik-Groups`: роли/группы (через запятую)
- `X-Authentik-Email`: email

Бэкенд может вернуть эту информацию фронтенду в ответе API.

## Преимущества этой архитектуры

1. ✅ **Фронтенд не хранит refresh token** - все токены управляются Authentik
2. ✅ **Фронтенд не обращается к Keycloak напрямую** - только через Authentik
3. ✅ **Бэкенд получает проверенные данные** - Authentik инжектирует заголовки после проверки
4. ✅ **Централизованное управление сессиями** - Authentik управляет всеми токенами
5. ✅ **Безопасность** - refresh token никогда не попадает в браузер
6. ✅ **Гибкость** - легко добавить другие провайдеры (LDAP, SAML и т.д.)

## Troubleshooting

### Проблема: Authentik не может подключиться к Keycloak

**Решение**: Убедитесь, что в настройках OAuth Source используется `http://keycloak:8080` (имя сервиса Docker), а не `http://localhost:8080`

### Проблема: CORS ошибки

**Решение**: Убедитесь, что в настройках Keycloak клиента указаны правильные Web Origins и Redirect URIs

### Проблема: Бэкенд не получает заголовки от Authentik

**Решение**: 
1. Убедитесь, что Proxy Provider настроен правильно
2. Проверьте, что Outpost запущен и связан с приложением бэкенда
3. Убедитесь, что запросы идут через Authentik proxy

### Проблема: Фронтенд не может получить userinfo

**Решение**: Убедитесь, что в OAuth2 Provider включена опция "Include claims in id_token" и добавлены scopes `openid profile email`

## Дополнительные настройки

### Настройка маппинга ролей из Keycloak в Authentik

1. Перейдите в **Customization** → **Property Mappings**
2. Создайте новый **Scope Mapping**
3. Настройте маппинг для передачи ролей из Keycloak в группы Authentik

### Настройка автоматического создания пользователей

В настройках OAuth Source включите:
- **User matching mode**: `Link to a user with identical email address`
- **User path template**: `goauthentik.io/sources/%(slug)s`

Это позволит автоматически создавать пользователей в Authentik при первом входе через Keycloak.

## Полезные ссылки

- [Authentik Documentation](https://goauthentik.io/docs/)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OAuth 2.0 PKCE](https://oauth.net/2/pkce/)
