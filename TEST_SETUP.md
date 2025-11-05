# Проверка настройки

## ✅ Быстрая проверка

### 1. Проверка сервисов

```bash
docker compose ps
```

Все сервисы должны быть `healthy` или `Up`.

### 2. Проверка Keycloak

1. Откройте http://localhost:8080
2. Войдите: `admin` / `admin`
3. Перейдите в realm `reports-realm`
4. Проверьте **Clients**:
   - ✅ `reports-frontend` - должен существовать
   - ✅ `reports-api` - должен существовать
   - ✅ `authentik` - **НОВЫЙ клиент для Authentik**

5. Откройте клиента `authentik`:
   - Client ID: `authentik`
   - Client authentication: ON
   - Valid redirect URIs: `http://localhost:9000/*`
   - Secret: `authentik-secret-change-me-in-production`

### 3. Проверка Authentik

1. Откройте http://localhost:9000
2. Войдите: `akadmin / Admin123!@#`
3. Перейдите в **Admin Interface**

4. Проверьте **Directory → Federation & Social login**:
   - ✅ Должен быть источник **Keycloak**
   - Slug: `keycloak`
   - Provider type: OpenID Connect
   - Consumer key: `authentik`

5. Проверьте **Applications → Applications**:
   - ✅ **BionicPro Frontend** (slug: `bionicpro-frontend`)
   - ✅ **BionicPro Backend** (slug: `bionicpro-backend`)

6. Проверьте **Applications → Providers**:
   - ✅ **BionicPro Frontend Provider** (OAuth2/OpenID)
   - ✅ **BionicPro Backend Proxy** (Proxy Provider)

### 4. Проверка Frontend

1. Запустите фронтенд:
   ```bash
   cd bionicpro-frontend
   npm install
   npm run dev
   ```

2. Откройте http://localhost:5173

3. Нажмите **"Войти через Authentik"**

4. Вы должны быть перенаправлены на Authentik

5. Authentik перенаправит вас на Keycloak

6. Войдите в Keycloak:
   - Username: `user1`
   - Password: `password123`

7. После успешного входа вы вернетесь на фронтенд

8. Вы должны увидеть:
   - ✅ Информацию о пользователе (username, email, groups)
   - ✅ Кнопку "Вызвать GET /reports"
   - ✅ Кнопку "Выйти"

### 5. Проверка Backend

1. Запустите бэкенд:
   ```bash
   cd reports_backend
   python main.py
   ```

2. На фронтенде нажмите **"Вызвать GET /reports"**

3. Вы должны увидеть ответ с:
   - HTTP статус: 200
   - Данные пользователя из заголовков Authentik
   - Список отчетов

## 🔍 Детальная проверка

### Проверка OAuth Source в Authentik

```bash
# Проверьте, что Keycloak доступен из Authentik
docker compose exec authentik_server curl -s http://keycloak:8080/realms/reports-realm/.well-known/openid-configuration | jq .issuer
```

Должно вернуть: `"http://keycloak:8080/realms/reports-realm"`

### Проверка Blueprint

```bash
# Проверьте, что blueprint файл доступен
docker compose exec authentik_server ls -la /blueprints/custom/

# Проверьте содержимое
docker compose exec authentik_server cat /blueprints/custom/initial-setup.yaml
```

### Проверка логов

```bash
# Логи Authentik
docker compose logs authentik_server | grep -i "blueprint\|error"

# Логи Keycloak
docker compose logs keycloak | grep -i "import\|error"
```

## ❌ Troubleshooting

### Проблема: "Client ID Error" на фронтенде

**Причина**: Blueprint не применился или Client ID не совпадает

**Решение**:
```bash
# Проверьте логи
docker compose logs authentik_worker | grep blueprint

# Примените blueprint вручную
docker compose exec authentik_server ak apply_blueprint /blueprints/custom/initial-setup.yaml

# Перезапустите Authentik
docker compose restart authentik_server authentik_worker
```

### Проблема: Keycloak не перенаправляет обратно в Authentik

**Причина**: Redirect URI не настроен в Keycloak

**Решение**:
1. Откройте Keycloak Admin Console
2. Перейдите в Clients → `authentik`
3. Проверьте Valid redirect URIs:
   - `http://localhost:9000/*`
   - `http://localhost:9000/source/oauth/callback/keycloak/*`

### Проблема: Authentik не может подключиться к Keycloak

**Причина**: Keycloak еще не запустился или неправильный URL

**Решение**:
```bash
# Проверьте, что Keycloak healthy
docker compose ps keycloak

# Проверьте URL из контейнера Authentik
docker compose exec authentik_server curl -v http://keycloak:8080/realms/reports-realm/.well-known/openid-configuration
```

### Проблема: Backend не получает заголовки

**Причина**: Proxy Provider не настроен или запросы идут напрямую

**Решение**:
1. Убедитесь, что запросы идут через Authentik (с credentials: 'include')
2. Проверьте Property Mappings в Proxy Provider
3. Проверьте логи бэкенда:
   ```bash
   # В логах должны быть заголовки X-Authentik-*
   ```

## 📊 Ожидаемый результат

После успешной настройки:

1. **Keycloak** содержит:
   - Realm `reports-realm`
   - Client `authentik` с правильными redirect URIs
   - Пользователей для тестирования

2. **Authentik** содержит:
   - OAuth Source `keycloak`
   - Application `BionicPro Frontend` с OAuth2 Provider
   - Application `BionicPro Backend` с Proxy Provider
   - Property Mappings для заголовков

3. **Frontend** может:
   - Перенаправить на Authentik для входа
   - Получить информацию о пользователе
   - Делать запросы к бэкенду

4. **Backend** получает:
   - `X-Authentik-Username`
   - `X-Authentik-Email`
   - `X-Authentik-Groups`
   - `X-Authentik-Uid`

## 🎉 Успешная настройка

Если все проверки пройдены, настройка завершена успешно!

Теперь можно:
- Добавлять новых пользователей в Keycloak
- Настраивать роли и группы
- Разрабатывать функционал приложения
- Деплоить в production (после замены секретов!)
