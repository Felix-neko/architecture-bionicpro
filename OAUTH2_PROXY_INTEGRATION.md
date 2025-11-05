# Интеграция OAuth2 Proxy с Keycloak

## Обзор архитектуры

Реализована интеграция **OAuth2 Proxy** как reverse proxy для управления сессиями и авторизацией:

```
Пользователь → OAuth2 Proxy (4180) → Vite Dev Server (5173) → React App
                     ↓
                 Keycloak (8080)
                     ↓
              Бэкенд FastAPI (3001)
```

### Компоненты

1. **OAuth2 Proxy** (порт 4180)
   - Reverse proxy для фронтенда и бэкенда
   - Управление сессиями через HttpOnly cookies
   - Хранение refresh token (не выдаётся фронтенду)
   - Автоматическое добавление Authorization заголовков с access token

2. **Keycloak** (порт 8080)
   - OIDC провайдер
   - Realm: `reports-realm`
   - Клиенты:
     - `oauth2-proxy` - для OAuth2 Proxy (confidential client)
     - `reports-frontend` - для прямого доступа (public client, legacy)
     - `reports-api` - для бэкенда (bearer-only)

3. **Фронтенд** (порт 5173)
   - React + Vite
   - Упрощённая версия без прямой интеграции с Keycloak
   - Работает через OAuth2 Proxy

4. **Бэкенд** (порт 3001)
   - FastAPI
   - Валидация JWT токенов от Keycloak
   - Endpoint: `/reports`

## Конфигурация OAuth2 Proxy

### Docker Compose

```yaml
oauth2-proxy:
  image: quay.io/oauth2-proxy/oauth2-proxy:latest
  command:
    - --provider=oidc
    - --client-id=oauth2-proxy
    - --client-secret=oauth2-proxy-secret-key-change-in-production
    - --oidc-issuer-url=http://keycloak:8080/realms/reports-realm
    - --redirect-url=http://localhost:4180/oauth2/callback
    - --cookie-secret=CHANGE_ME_TO_32_CHAR_RANDOM_STRING_12345678
    - --cookie-secure=false  # Только для dev
    - --cookie-httponly=true
    - --cookie-samesite=lax
    - --upstream=http://host.docker.internal:5173
    - --pass-access-token=true
    - --set-authorization-header=true
  ports:
    - "4180:4180"
```

### Ключевые параметры

- **`--upstream`**: Проксирует на Vite dev server на хосте
- **`--cookie-httponly=true`**: Защита от XSS атак
- **`--pass-access-token=true`**: Передача access token в заголовках
- **`--set-authorization-header=true`**: Автоматическое добавление Authorization заголовка

## Изменения в фронтенде

### App.tsx

Упрощённая версия без Keycloak SDK:

```typescript
// OAuth2-proxy автоматически управляет авторизацией
// Если пользователь не авторизован, он будет редиректнут на страницу входа
useEffect(() => {
  setLoadingUser(false);
  setUserInfo({ email: 'Authorized User' });
}, []);
```

### Вызов бэкенда

```typescript
const response = await fetch('/api/reports', {
  method: 'GET',
  credentials: 'include', // Включаем cookies
});
```

OAuth2 Proxy автоматически добавит `Authorization: Bearer <access_token>` заголовок.

## Изменения в бэкенде

Бэкенд обновлён для работы без проверки audience (так как публичный клиент не включает audience):

```python
payload = jwt.decode(
    token,
    public_key,
    algorithms=list(KeycloakConfig.algorithms),
    options={"verify_aud": False},  # Не проверяем audience
    issuer=KeycloakConfig.issuer,
)

# Проверяем azp (authorized party)
if payload.get("azp") not in ["reports-frontend", "reports-api"]:
    raise HTTPException(status_code=401, detail="Token not issued for this application")
```

## Тесты

### Структура тестов

- `tests/test_e2e_oauth2_proxy.py` - E2E тесты для OAuth2 Proxy
- `tests/test_e2e_keycloak.py` - E2E тесты для прямого доступа к Keycloak (legacy)
- `tests/conftest.py` - Общие фикстуры

### Запуск тестов

```bash
# Все тесты OAuth2 Proxy
pytest tests/test_e2e_oauth2_proxy.py -v -s

# Конкретный тест
pytest tests/test_e2e_oauth2_proxy.py::TestOAuth2ProxyAuthentication::test_login_flow_via_oauth2_proxy -v -s
```

## Безопасность

### Что улучшено

1. **Refresh token не выдаётся фронтенду**
   - Хранится в OAuth2 Proxy
   - Фронтенд получает только session cookie

2. **HttpOnly cookies**
   - Защита от XSS атак
   - JavaScript не может получить доступ к cookie

3. **Автоматическое обновление токенов**
   - OAuth2 Proxy обновляет токены каждые 5 минут
   - Фронтенд не участвует в процессе

4. **Централизованное управление сессиями**
   - Единая точка для logout
   - Контроль времени жизни сессий

## Известные проблемы

### 1. OAuth2 Proxy не может подключиться к upstream

**Проблема**: OAuth2 Proxy в Docker не может подключиться к `host.docker.internal:5173`

**Решение**: 
- Добавить `extra_hosts` в docker-compose
- Или запустить Vite в Docker контейнере

### 2. Cookie domain warnings

**Проблема**: Предупреждения о несоответствии cookie domain

**Решение**: Не указывать `--cookie-domain`, чтобы использовался домен запроса

## Production Deployment

Для продакшена необходимо:

1. **Изменить секреты**:
   ```yaml
   - --client-secret=<STRONG_SECRET>
   - --cookie-secret=<32_CHAR_RANDOM_STRING>
   ```

2. **Включить HTTPS**:
   ```yaml
   - --cookie-secure=true
   - --redirect-url=https://your-domain.com/oauth2/callback
   ```

3. **Собрать фронтенд**:
   ```bash
   cd bionicpro-frontend
   npm run build
   ```

4. **Настроить upstream на статические файлы**:
   ```yaml
   - --upstream=file:///app/dist#/
   ```

5. **Обновить Keycloak redirect URIs**:
   - Добавить production URL в `redirectUris`

## Дальнейшие улучшения

1. **Добавить Redis для хранения сессий**
   - Для масштабирования на несколько инстансов OAuth2 Proxy

2. **Настроить rate limiting**
   - Защита от brute-force атак

3. **Добавить мониторинг**
   - Prometheus metrics от OAuth2 Proxy
   - Grafana dashboards

4. **Настроить CORS правильно**
   - Ограничить allowed origins

5. **Добавить Content Security Policy (CSP)**
   - Защита от XSS

## Полезные команды

```bash
# Перезапуск OAuth2 Proxy
docker compose up -d oauth2-proxy

# Просмотр логов
docker logs -f architecture-bionicpro-oauth2-proxy-1

# Проверка доступности
curl -I http://localhost:4180/

# Запуск тестов
source .venv/bin/activate
pytest tests/test_e2e_oauth2_proxy.py -v -s
```

## Ссылки

- [OAuth2 Proxy Documentation](https://oauth2-proxy.github.io/oauth2-proxy/)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OIDC Specification](https://openid.net/connect/)
