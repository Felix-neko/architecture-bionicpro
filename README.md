# BionicPro Architecture with Authentik

Полная архитектура аутентификации с **Authentik** как прокси между фронтендом и бэкендом, используя **Keycloak** как Identity Provider.

## 🚀 Быстрый старт

```bash
# 1. Запустите все сервисы
docker compose up -d

# 2. Проверьте статус
./verify_setup.sh

# 3. Запустите фронтенд
cd bionicpro-frontend
npm install
npm run dev

# 4. Откройте браузер
open http://localhost:5173
```

## ✨ Особенности

✅ **Фронтенд не хранит refresh token** - все токены в Authentik  
✅ **Автоматическая настройка** - Keycloak realm + Authentik blueprints  
✅ **Конфигурация в репозитории** - все настройки в читаемом виде  
✅ **Безопасность** - OAuth 2.0 + PKCE, инжекция заголовков  
✅ **Готово к использованию** - работает из коробки  

## 📊 Архитектура

```
Frontend (5173) → Authentik (9000) → Keycloak (8080) → OpenLDAP (389)
                       ↓
                  Backend (3001)
              (с заголовками X-Authentik-*)
```

## 🔐 Учетные данные

| Сервис | URL | Логин | Пароль |
|--------|-----|-------|--------|
| Keycloak | http://localhost:8080 | admin | admin |
| Authentik | http://localhost:9000 | akadmin / Admin123!@# |
| Frontend | http://localhost:5173 | user1 | password123 |
| phpLDAPadmin | http://localhost:8081 | cn=admin,dc=zambia,dc=local | admin123 |

## 📚 Документация

| Файл | Описание |
|------|----------|
| [QUICK_START.md](./QUICK_START.md) | Быстрый старт за 5 минут |
| [FINAL_SUMMARY.md](./FINAL_SUMMARY.md) | Полная сводка реализации |
| [TEST_SETUP.md](./TEST_SETUP.md) | Инструкции по проверке |
| [CONFIGURATION.md](./CONFIGURATION.md) | Описание конфигурации |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Детальная архитектура |

## 🔧 Конфигурационные файлы

```
keycloak/realm-export.json              # Keycloak realm с клиентом authentik
authentik-blueprints/initial-setup.yaml # Автоматическая настройка Authentik
docker-compose.yaml                     # Все сервисы
bionicpro-frontend/src/App.tsx          # OAuth 2.0 + PKCE
reports_backend/main.py                 # Чтение заголовков X-Authentik-*
```

## 🎯 Что реализовано

### Keycloak
- ✅ Realm `reports-realm` с автоматическим импортом
- ✅ Client `authentik` для Authentik OAuth
- ✅ Пользователи: user1, admin1, prothetic1
- ✅ Роли: users, administrators, prothetic_users
- ✅ LDAP интеграция с OpenLDAP

### Authentik
- ✅ OAuth Source для Keycloak
- ✅ OAuth2 Provider для фронтенда (Client ID: `bionicpro-frontend`)
- ✅ Proxy Provider для бэкенда с инжекцией заголовков
- ✅ Applications: BionicPro Frontend, BionicPro Backend
- ✅ Property Mappings: `X-Authentik-Username`, `X-Authentik-Email`, `X-Authentik-Groups`, `X-Authentik-Uid`

### Frontend
- ✅ OAuth 2.0 Authorization Code Flow с PKCE
- ✅ Автоматическая проверка аутентификации
- ✅ Получение UserInfo от Authentik
- ✅ Запросы к бэкенду через cookies
- ✅ Отображение информации о пользователе

### Backend
- ✅ Чтение заголовков `X-Authentik-*`
- ✅ Endpoint `/reports` с данными пользователя
- ✅ CORS настроен для Authentik и фронтенда

## 🧪 Тестирование

```bash
# Проверка всех сервисов
./verify_setup.sh

# Проверка статуса
docker compose ps

# Проверка логов
docker compose logs -f authentik_server

# Проверка blueprint
docker compose exec authentik_server cat /blueprints/custom/initial-setup.yaml
```

## 🐛 Troubleshooting

### "Client ID Error" на фронтенде

```bash
# Перезапустите Authentik
docker compose restart authentik_server authentik_worker

# Примените blueprint вручную
docker compose exec authentik_server ak apply_blueprint /blueprints/custom/initial-setup.yaml
```

### Keycloak не перенаправляет в Authentik

Проверьте клиента `authentik` в Keycloak:
- Valid redirect URIs: `http://localhost:9000/*`

### Backend не получает заголовки

Убедитесь, что запросы идут с `credentials: 'include'`

## 🔄 Обновление

```bash
# Полный перезапуск с очисткой
docker compose down -v
docker compose up -d

# Только Authentik
docker compose restart authentik_server authentik_worker

# Только Keycloak
docker compose down -v keycloak keycloak_db
docker compose up -d keycloak
```

## 📦 Production

Перед деплоем в production:

1. **Замените секреты** в `keycloak/realm-export.json` и `authentik-blueprints/initial-setup.yaml`
2. **Настройте HTTPS** для всех сервисов
3. **Настройте домены** вместо localhost
4. **Настройте backup** для PostgreSQL
5. **Настройте мониторинг** (Prometheus + Grafana)

## 📞 Поддержка

- Документация: См. файлы `*.md` в корне проекта
- Логи: `docker compose logs -f <service>`
- Проверка: `./verify_setup.sh`

## 📄 Лицензия

MIT License

---

**Статус**: ✅ Готово к использованию  
**Версия**: 1.0  
**Дата**: 2025-11-05
