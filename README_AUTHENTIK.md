# BionicPro с Authentik Authentication Proxy

## 📋 Обзор

Этот проект реализует безопасную архитектуру аутентификации, где **Authentik** выступает как прокси между фронтендом и бэкендом, используя **Keycloak** как провайдер идентификации.

## 🎯 Ключевые особенности

✅ **Фронтенд НЕ хранит refresh token** - все токены управляются Authentik  
✅ **Фронтенд НЕ обращается к Keycloak напрямую** - только через Authentik  
✅ **Бэкенд получает проверенные данные** через заголовки от Authentik  
✅ **Централизованное управление сессиями** в Authentik  
✅ **OAuth 2.0 + PKCE** для максимальной безопасности  
✅ **Автоматическое обновление токенов** без участия фронтенда  

## 🏗️ Архитектура

```
Frontend (localhost:5173)
    ↓ OAuth 2.0 + PKCE
Authentik (localhost:9000)
    ↓ OAuth Source          ↓ Proxy + Headers
Keycloak (localhost:8080)   Backend (localhost:3001)
    ↓ LDAP Federation
OpenLDAP (localhost:389)
```

**Детальная схема**: См. [ARCHITECTURE.md](./ARCHITECTURE.md)

## 🚀 Быстрый старт

### 1. Запуск сервисов

```bash
# Запуск всех Docker сервисов
docker compose up -d

# Проверка статуса
docker compose ps
```

### 2. Настройка (первый раз)

Следуйте инструкциям в [QUICK_START.md](./QUICK_START.md)

Основные шаги:
1. Настроить клиента в Keycloak для Authentik
2. Создать OAuth Source в Authentik для Keycloak
3. Создать приложение в Authentik для фронтенда
4. (Опционально) Настроить Proxy Provider для бэкенда

### 3. Запуск приложения

```bash
# Терминал 1: Backend
cd reports_backend
python main.py

# Терминал 2: Frontend
cd bionicpro-frontend
npm install  # только первый раз
npm run dev
```

### 4. Тестирование

Откройте http://localhost:5173 и войдите через Authentik

## 📚 Документация

| Файл | Описание |
|------|----------|
| [QUICK_START.md](./QUICK_START.md) | Быстрая настройка за 5 минут |
| [AUTHENTIK_SETUP.md](./AUTHENTIK_SETUP.md) | Детальная настройка Authentik |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Архитектура и потоки данных |

## 🔐 Безопасность

### Что НЕ попадает в браузер

- ❌ Refresh token (хранится в Authentik)
- ❌ Keycloak access token (между Authentik ↔ Keycloak)
- ❌ Client secrets

### Что получает фронтенд

- ✅ Session cookie от Authentik (httpOnly)
- ✅ UserInfo от Authentik (username, email, groups)
- ✅ Короткоживущий access token от Authentik

### Что получает бэкенд

Authentik инжектирует заголовки в каждый запрос:
- `X-Authentik-Username` - имя пользователя
- `X-Authentik-Email` - email
- `X-Authentik-Groups` - роли/группы (через запятую)
- `X-Authentik-Uid` - уникальный ID

## 🛠️ Технологии

### Frontend
- **React 18** + TypeScript
- **Vite** - сборщик
- **TailwindCSS** - стилизация
- **OAuth 2.0 PKCE** - аутентификация

### Backend
- **FastAPI** - REST API
- **Python 3.11+**
- **Header-based auth** - через Authentik

### Infrastructure
- **Authentik** - Identity Proxy
- **Keycloak** - Identity Provider
- **PostgreSQL** - БД для Keycloak и Authentik
- **Redis** - Кеш для Authentik
- **OpenLDAP** - User Directory (опционально)

## 📊 Порты сервисов

| Сервис | Порт | URL |
|--------|------|-----|
| Frontend | 5173 | http://localhost:5173 |
| Backend | 3001 | http://localhost:3001 |
| Authentik | 9000 | http://localhost:9000 |
| Keycloak | 8080 | http://localhost:8080 |
| phpLDAPadmin | 8081 | http://localhost:8081 |
| PostgreSQL (Keycloak) | 5433 | - |
| PostgreSQL (Authentik) | 5434 | - |
| OpenLDAP | 389 | - |

## ❓ FAQ

### Может ли фронтенд узнать username и роли пользователя?

**Да!** Фронтенд получает эту информацию через Authentik UserInfo endpoint:

```typescript
const response = await fetch('http://localhost:9000/application/o/userinfo/', {
  credentials: 'include'
});

const userInfo = await response.json();
// { sub, email, preferred_username, groups, ... }
```

### Как бэкенд проверяет аутентификацию?

Бэкенд читает заголовки, которые инжектирует Authentik:

```python
async def get_user_from_headers(
    x_authentik_username: str = Header(alias="X-Authentik-Username"),
    x_authentik_groups: str = Header(alias="X-Authentik-Groups"),
    # ...
):
    return {
        "username": x_authentik_username,
        "groups": x_authentik_groups.split(","),
        # ...
    }
```

### Нужно ли настраивать CORS?

Да, бэкенд уже настроен:
- Разрешены origins: `localhost:5173`, `localhost:9000`
- Включены credentials для cookies
- Exposed headers для чтения заголовков Authentik

### Как работает обновление токенов?

Authentik автоматически обновляет токены:
1. Authentik хранит refresh token от Keycloak
2. Когда access token истекает, Authentik автоматически обновляет его
3. Фронтенд ничего не знает об этом процессе

### Можно ли использовать другой IdP вместо Keycloak?

Да! Authentik поддерживает множество провайдеров:
- Google OAuth
- GitHub OAuth
- Azure AD
- SAML 2.0
- LDAP
- И многие другие

Просто создайте новый OAuth Source в Authentik.

## 🐛 Troubleshooting

### Authentik не может подключиться к Keycloak

**Проблема**: `Connection refused` или `Name resolution failed`

**Решение**: В настройках OAuth Source используйте `http://keycloak:8080` (имя Docker сервиса), а не `http://localhost:8080`

### CORS ошибки в браузере

**Проблема**: `Access-Control-Allow-Origin` ошибки

**Решение**: 
1. Проверьте настройки клиента в Keycloak (Web Origins)
2. Убедитесь, что бэкенд включает `credentials: 'include'`
3. Проверьте CORS настройки в FastAPI

### Бэкенд не получает заголовки

**Проблема**: `X-Authentik-*` заголовки отсутствуют

**Решение**: 
1. Убедитесь, что настроен Proxy Provider в Authentik
2. Проверьте, что Outpost запущен и связан с приложением
3. Запросы должны идти через Authentik, а не напрямую к бэкенду

### Frontend не может получить userinfo

**Проблема**: 401 или 403 при запросе к `/application/o/userinfo/`

**Решение**:
1. Проверьте, что включена опция "Include claims in id_token"
2. Убедитесь, что добавлены scopes: `openid profile email`
3. Проверьте cookies в браузере

## 🔄 Обновление зависимостей

### Frontend

```bash
cd bionicpro-frontend
npm update
```

### Backend

```bash
cd reports_backend
pip install --upgrade -r requirements.txt
```

### Docker образы

```bash
docker compose pull
docker compose up -d
```

## 🧪 Тестирование

### Проверка аутентификации

```bash
# Получить userinfo (требуется активная сессия)
curl -X GET http://localhost:9000/application/o/userinfo/ \
  --cookie "authentik_session=<session_cookie>"
```

### Проверка бэкенда

```bash
# Прямой запрос с заголовками (имитация Authentik)
curl -X GET http://localhost:3001/reports \
  -H "X-Authentik-Username: testuser" \
  -H "X-Authentik-Email: test@example.com" \
  -H "X-Authentik-Groups: admin,user"
```

## 📝 Логи

### Просмотр логов всех сервисов

```bash
docker compose logs -f
```

### Логи конкретного сервиса

```bash
docker compose logs -f authentik_server
docker compose logs -f keycloak
```

### Логи приложения

```bash
# Backend
cd reports_backend
python main.py  # логи в stdout

# Frontend
cd bionicpro-frontend
npm run dev  # логи в stdout
```

## 🚧 Известные ограничения

1. **HTTP вместо HTTPS**: В production используйте HTTPS для всех сервисов
2. **Hardcoded URLs**: В production используйте переменные окружения
3. **Простые пароли**: В production используйте сложные пароли и secrets
4. **Без rate limiting**: Добавьте rate limiting для API endpoints
5. **Без мониторинга**: Добавьте Prometheus/Grafana для мониторинга

## 🎓 Дополнительные ресурсы

- [Authentik Documentation](https://goauthentik.io/docs/)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OAuth 2.0 RFC](https://datatracker.ietf.org/doc/html/rfc6749)
- [PKCE RFC](https://datatracker.ietf.org/doc/html/rfc7636)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)

## 📄 Лицензия

MIT License

## 👥 Авторы

BionicPro Team

## 🤝 Вклад

Pull requests приветствуются! Для больших изменений сначала откройте issue для обсуждения.

---

**Важно**: Это демонстрационная конфигурация. Для production окружения необходимо:
- Использовать HTTPS
- Настроить proper secrets management
- Добавить rate limiting
- Настроить мониторинг и алертинг
- Провести security audit
