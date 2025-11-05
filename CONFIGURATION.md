# Конфигурация проекта

## Обзор

Все настройки проекта хранятся в репозитории в читаемом виде:

```
architecture-bionicpro/
├── keycloak/
│   └── realm-export.json          # Конфигурация Keycloak realm
├── authentik-blueprints/
│   ├── initial-setup.yaml         # Автоматическая настройка Authentik
│   └── README.md                  # Документация по blueprints
├── docker-compose.yaml            # Конфигурация всех сервисов
└── .env.example                   # Шаблон переменных окружения
```

## Keycloak Configuration

### Файл: `keycloak/realm-export.json`

Этот файл содержит полную конфигурацию Keycloak realm `reports-realm`:

#### Клиенты

1. **reports-frontend** (Public Client)
   - Для прямого использования фронтендом (legacy)
   - Redirect URIs: `http://localhost:3000/*`, `http://localhost:5173/*`

2. **reports-api** (Confidential Client)
   - Для бэкенда API
   - Bearer-only: true
   - Secret: `oNwoLQdvJAvRcL89SydqCWCe5ry1jMgq`

3. **authentik** (Confidential Client) ⭐ **НОВЫЙ**
   - Для интеграции с Authentik
   - Client ID: `authentik`
   - Secret: `authentik-secret-change-me-in-production`
   - Redirect URIs:
     - `http://localhost:9000/*`
     - `http://localhost:9000/source/oauth/callback/keycloak/*`
   - Protocol Mappers:
     - `groups` - передает группы пользователя
     - `email` - передает email
     - `username` - передает preferred_username

#### Роли

- `users` - обычные пользователи
- `administrators` - администраторы
- `prothetic_users` - пользователи с доступом к отчетам
- `customers` - клиенты (из LDAP)
- `employees` - сотрудники (из LDAP)

#### Пользователи

Предустановленные пользователи для тестирования:

| Username | Password | Email | Roles |
|----------|----------|-------|-------|
| user1 | password123 | user1@example.com | users |
| admin1 | admin123 | admin1@example.com | administrators, users |
| prothetic1 | prothetic123 | prothetic1@example.com | prothetic_users |

#### LDAP Integration

Настроена интеграция с OpenLDAP:
- Connection URL: `ldap://openldap-zambia:389`
- Users DN: `ou=users,dc=zambia,dc=local`
- Bind DN: `cn=admin,dc=zambia,dc=local`
- Bind Password: `admin123`

### Применение конфигурации

Keycloak автоматически импортирует realm при первом запуске благодаря:

```yaml
command: 
  - start-dev
  - --import-realm
volumes:
  - ./keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json
```

### Обновление конфигурации

Если нужно изменить конфигурацию Keycloak:

1. **Вариант 1: Через UI (рекомендуется для разработки)**
   ```bash
   # Откройте http://localhost:8080
   # Внесите изменения через Admin Console
   # Экспортируйте realm
   docker compose exec keycloak /opt/keycloak/bin/kc.sh export \
     --dir /tmp --realm reports-realm
   docker compose cp keycloak:/tmp/reports-realm-realm.json ./keycloak/realm-export.json
   ```

2. **Вариант 2: Редактирование JSON (для production)**
   ```bash
   # Отредактируйте keycloak/realm-export.json
   # Пересоздайте Keycloak
   docker compose down -v keycloak keycloak_db
   docker compose up -d keycloak
   ```

## Authentik Configuration

### Файл: `authentik-blueprints/initial-setup.yaml`

Этот Blueprint автоматически создает всю необходимую конфигурацию Authentik.

#### OAuth Source (Keycloak)

```yaml
- model: authentik_sources_oauth.oauthsource
  identifiers:
    slug: keycloak
  attrs:
    name: Keycloak
    consumer_key: authentik
    consumer_secret: authentik-secret-change-me-in-production
    oidc_well_known_url: http://keycloak:8080/realms/reports-realm/.well-known/openid-configuration
```

⚠️ **ВАЖНО**: `consumer_secret` должен совпадать с `secret` клиента `authentik` в Keycloak!

#### OAuth2 Provider (Frontend)

```yaml
- model: authentik_providers_oauth2.oauth2provider
  attrs:
    client_id: bionicpro-frontend
    client_type: public
    redirect_uris: |
      http://localhost:5173/callback
      http://localhost:5173/*
```

Это позволяет фронтенду аутентифицироваться через Authentik.

#### Proxy Provider (Backend)

```yaml
- model: authentik_providers_proxy.proxyprovider
  attrs:
    mode: forward_single
    external_host: http://localhost:3001
    internal_host: http://host.docker.internal:3001
```

Это настраивает Authentik как прокси для бэкенда с инжекцией заголовков.

#### Property Mappings

Определяют, какие заголовки инжектируются в запросы к бэкенду:

- `X-Authentik-Username` - имя пользователя
- `X-Authentik-Email` - email
- `X-Authentik-Groups` - группы через запятую
- `X-Authentik-Uid` - уникальный ID

### Применение конфигурации

Blueprints применяются автоматически при запуске Authentik благодаря:

```yaml
volumes:
  - ./authentik-blueprints:/blueprints/custom:ro
```

И метке в YAML:

```yaml
metadata:
  labels:
    blueprints.goauthentik.io/instantiate: "true"
```

### Проверка применения

```bash
# Проверьте логи
docker compose logs authentik_server | grep -i blueprint

# Должны увидеть:
# Successfully applied blueprint ...
```

Или через UI:
1. Откройте http://localhost:9000/if/admin
2. Войдите: `akadmin / Admin123!@#`
3. Проверьте созданные объекты

### Обновление конфигурации

Если нужно изменить конфигурацию Authentik:

1. **Отредактируйте** `authentik-blueprints/initial-setup.yaml`
2. **Перезапустите** Authentik:
   ```bash
   docker compose restart authentik_server authentik_worker
   ```
3. **Проверьте** логи:
   ```bash
   docker compose logs -f authentik_server
   ```

## Docker Compose Configuration

### Файл: `docker-compose.yaml`

#### Сервисы

1. **keycloak_db** - PostgreSQL для Keycloak (порт 5433)
2. **keycloak** - Keycloak IdP (порт 8080)
3. **openldap-zambia** - LDAP directory (порт 389)
4. **phpldapadmin** - LDAP admin UI (порт 8081)
5. **authentik_db** - PostgreSQL для Authentik (порт 5434)
6. **authentik_redis** - Redis для Authentik
7. **authentik_server** - Authentik server (порты 9000, 9444)
8. **authentik_worker** - Authentik worker
9. **frontend** - React frontend (порт 3000)

#### Volumes

- `authentik_media` - Медиа файлы Authentik
- `authentik_templates` - Кастомные шаблоны Authentik

#### Networks

Все сервисы в одной сети `default` для взаимодействия по именам сервисов.

### Важные зависимости

```yaml
authentik_server:
  depends_on:
    authentik_db:
      condition: service_healthy
    authentik_redis:
      condition: service_healthy
    keycloak:
      condition: service_healthy  # ⭐ Ждет готовности Keycloak
```

Это гарантирует, что Authentik запустится только после полной инициализации Keycloak.

## Environment Variables

### Файл: `.env.example`

Шаблон для переменных окружения. Скопируйте в `.env` и настройте:

```bash
cp .env.example .env
```

### Критичные переменные

```bash
# Authentik
AUTHENTIK_SECRET_KEY=change-me-to-a-random-string-at-least-50-chars-long-please
AUTHENTIK_BOOTSTRAP_PASSWORD=admin

# Keycloak
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin

# Keycloak Client Secret (должен совпадать с realm-export.json)
AUTHENTIK_CLIENT_SECRET=authentik-secret-change-me-in-production
```

## Frontend Configuration

### Файл: `bionicpro-frontend/src/App.tsx`

Константы конфигурации в начале файла:

```typescript
const AUTHENTIK_URL = 'http://localhost:9000'
const CLIENT_ID = 'bionicpro-frontend'
const REDIRECT_URI = 'http://localhost:5173/callback'
const BACKEND_URL = 'http://localhost:3001'
```

### Изменение конфигурации

Если меняете порты или хосты:

1. Обновите константы в `App.tsx`
2. Обновите `redirect_uris` в `authentik-blueprints/initial-setup.yaml`
3. Перезапустите Authentik и фронтенд

## Backend Configuration

### Файл: `reports_backend/main.py`

Конфигурация в классе `KeycloakConfig`:

```python
class KeycloakConfig:
    issuer: str = "http://localhost:8080/realms/reports-realm"
    jwks_url: str = f"{issuer}/protocol/openid-connect/certs"
    audience: str | None = "reports-api"
    algorithms: tuple[str, ...] = ("RS256",)
```

Эта конфигурация используется только для debug endpoint `/reports-jwt`.

Основной endpoint `/reports` использует заголовки от Authentik и не требует настройки.

## Полный цикл обновления конфигурации

### Сценарий: Изменение портов

1. **Обновите docker-compose.yaml**:
   ```yaml
   ports:
     - "НОВЫЙ_ПОРТ:9000"
   ```

2. **Обновите Keycloak realm**:
   ```json
   "redirectUris": [
     "http://localhost:НОВЫЙ_ПОРТ/*"
   ]
   ```

3. **Обновите Authentik blueprint**:
   ```yaml
   redirect_uris: |
     http://localhost:НОВЫЙ_ПОРТ/callback
   ```

4. **Обновите Frontend**:
   ```typescript
   const AUTHENTIK_URL = 'http://localhost:НОВЫЙ_ПОРТ'
   ```

5. **Пересоздайте сервисы**:
   ```bash
   docker compose down -v
   docker compose up -d
   ```

## Секреты и безопасность

### Development

Текущие секреты подходят для разработки:
- Keycloak admin: `admin` / `admin`
- Authentik admin: `akadmin / Admin123!@#`
- Client secret: `authentik-secret-change-me-in-production`

### Production

⚠️ **ОБЯЗАТЕЛЬНО замените**:

1. **Сгенерируйте сложные пароли**:
   ```bash
   openssl rand -base64 32
   ```

2. **Обновите в файлах**:
   - `docker-compose.yaml` - пароли БД и admin
   - `keycloak/realm-export.json` - client secrets
   - `authentik-blueprints/initial-setup.yaml` - consumer_secret
   - `.env` - все секреты

3. **Используйте secrets management**:
   - Docker Secrets
   - HashiCorp Vault
   - AWS Secrets Manager
   - Azure Key Vault

## Backup и восстановление

### Backup конфигурации

Все конфигурационные файлы уже в Git:
```bash
git add keycloak/realm-export.json
git add authentik-blueprints/initial-setup.yaml
git add docker-compose.yaml
git commit -m "Update configuration"
```

### Backup данных

```bash
# PostgreSQL (Keycloak)
docker compose exec keycloak_db pg_dump -U keycloak_user keycloak_db > backup_keycloak.sql

# PostgreSQL (Authentik)
docker compose exec authentik_db pg_dump -U authentik authentik > backup_authentik.sql
```

### Восстановление

```bash
# Восстановите конфигурацию из Git
git checkout main

# Пересоздайте сервисы
docker compose down -v
docker compose up -d
```

## Troubleshooting

### Проблема: Keycloak не импортирует realm

**Решение**:
```bash
# Проверьте логи
docker compose logs keycloak | grep import

# Проверьте файл
docker compose exec keycloak cat /opt/keycloak/data/import/realm-export.json

# Пересоздайте
docker compose down -v keycloak keycloak_db
docker compose up -d keycloak
```

### Проблема: Authentik не применяет blueprint

**Решение**:
```bash
# Проверьте логи
docker compose logs authentik_server | grep blueprint

# Проверьте файл
docker compose exec authentik_server cat /blueprints/custom/initial-setup.yaml

# Примените вручную
docker compose exec authentik_server ak apply_blueprint /blueprints/custom/initial-setup.yaml
```

### Проблема: Client ID Error на фронтенде

**Причины**:
1. Blueprint не применился
2. Client ID не совпадает
3. Redirect URI не совпадает

**Решение**:
1. Проверьте в Authentik Admin UI наличие приложения
2. Проверьте Client ID в blueprint и App.tsx
3. Проверьте Redirect URIs

## Дополнительные ресурсы

- [Keycloak Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/)
- [Authentik Configuration](https://goauthentik.io/docs/installation/configuration)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
