# Быстрый старт

## 1. Запуск всех сервисов

```bash
# Запуск Docker сервисов (Keycloak, Authentik, PostgreSQL, Redis, LDAP)
docker compose up -d

# Ожидание запуска всех сервисов (около 30-60 секунд)
docker compose logs -f
```

## 2. Настройка Keycloak (один раз)

1. Откройте http://localhost:8080
2. Войдите: `admin` / `admin`
3. Перейдите в realm `reports-realm`
4. Создайте клиента для Authentik:
   - **Clients** → **Create client**
   - **Client ID**: `authentik-client`
   - **Client authentication**: `ON`
   - **Valid redirect URIs**: `http://localhost:9000/*`
   - Сохраните **Client Secret** из вкладки **Credentials**

## 3. Настройка Authentik (один раз)

### 3.1 Первый вход
1. Откройте http://localhost:9000
2. Войдите: `akadmin / Admin123!@#`

### 3.2 Создание OAuth Source (Keycloak)
1. **Directory** → **Federation & Social login** → **Create**
2. Выберите **OAuth Source**:
   - **Name**: `keycloak`
   - **Slug**: `keycloak`
   - **Provider type**: `OpenID Connect`
   - **Consumer key**: `authentik-client`
   - **Consumer secret**: `<Client Secret из Keycloak>`
   - **OIDC Well-known URL**: `http://keycloak:8080/realms/reports-realm/.well-known/openid-configuration`

### 3.3 Создание приложения для фронтенда
1. **Applications** → **Applications** → **Create**
2. **Create with Wizard**:
   - **Name**: `BionicPro Frontend`
   - **Slug**: `bionicpro-frontend`
   - **Provider**: **Create new OAuth2/OpenID Provider**
     - **Client type**: `Public`
     - **Client ID**: `bionicpro-frontend`
     - **Redirect URIs**: `http://localhost:5173/callback`

## 4. Запуск бэкенда

```bash
# Из корневой директории проекта
cd reports_backend
python main.py
```

Или:

```bash
uvicorn reports_backend.main:app --host 0.0.0.0 --port 3001
```

## 5. Запуск фронтенда

```bash
cd bionicpro-frontend
npm install  # только первый раз
npm run dev
```

## 6. Тестирование

1. Откройте http://localhost:5173
2. Нажмите **"Войти через Authentik"**
3. Войдите через Keycloak
4. Проверьте информацию о пользователе
5. Нажмите **"Вызвать GET /reports"**

## Порты сервисов

| Сервис | Порт | URL |
|--------|------|-----|
| Frontend | 5173 | http://localhost:5173 |
| Backend | 3001 | http://localhost:3001 |
| Keycloak | 8080 | http://localhost:8080 |
| Authentik | 9000 | http://localhost:9000 |
| phpLDAPadmin | 8081 | http://localhost:8081 |
| PostgreSQL (Keycloak) | 5433 | localhost:5433 |
| PostgreSQL (Authentik) | 5434 | localhost:5434 |
| OpenLDAP | 389 | localhost:389 |

## Остановка сервисов

```bash
# Остановка с удалением volumes (полная очистка)
docker compose down -v

# Остановка без удаления данных
docker compose down
```

## Полная документация

Смотрите [AUTHENTIK_SETUP.md](./AUTHENTIK_SETUP.md) для детальной настройки.
