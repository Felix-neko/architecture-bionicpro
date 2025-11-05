# Troubleshooting Guide

## Проблемы с Authentik

### Кнопка Keycloak не появляется на странице входа

**Симптомы:**
- На странице входа Authentik (http://localhost:9000) нет кнопки для входа через Keycloak
- Пользователи не могут войти через Keycloak
- Ошибка "invalid_identifier" при попытке войти как user1

**Причина:**
OAuth Source (Keycloak) не был добавлен к Identification Stage в authentication flow.

**Решение:**

#### Вариант 1: Через Django shell (быстро)

```bash
docker compose exec -T authentik_server ak shell <<'EOF'
from authentik.stages.identification.models import IdentificationStage
from authentik.sources.oauth.models import OAuthSource

# Получаем identification stage
stage = IdentificationStage.objects.get(name='default-authentication-identification')

# Получаем OAuth Source
keycloak_source = OAuthSource.objects.get(slug='keycloak')

# Добавляем source к stage
stage.sources.add(keycloak_source)
stage.save()

print(f"Added Keycloak source to {stage.name}")
EOF
```

#### Вариант 2: Через Admin UI

1. Откройте http://localhost:9000
2. Войдите как `akadmin` / `Admin123!@#`
3. Перейдите в **Admin Interface**
4. **Flows & Stages** → **Stages**
5. Найдите `default-authentication-identification`
6. Нажмите **Edit**
7. В поле **Sources** добавьте `Keycloak`
8. Нажмите **Update**

### Кнопка Keycloak перенаправляет на http://keycloak:8080 вместо localhost:8080

**Симптомы:**
- При клике на кнопку Keycloak браузер пытается открыть http://keycloak:8080
- Ошибка "This site can't be reached" или "ERR_NAME_NOT_RESOLVED"

**Причина:**
OAuth Source настроен с внутренним Docker DNS именем `keycloak`, которое недоступно из браузера.

**Решение:**

Обновите URLs на localhost:

```bash
docker compose exec -T authentik_server ak shell <<'EOF'
from authentik.sources.oauth.models import OAuthSource

source = OAuthSource.objects.get(slug='keycloak')
source.oidc_well_known_url = 'http://localhost:8080/realms/reports-realm/.well-known/openid-configuration'
source.oidc_jwks_url = 'http://localhost:8080/realms/reports-realm/protocol/openid-connect/certs'
source.save()

print(f"Updated OAuth Source: {source.name}")
EOF
```

### OAuth Source (Keycloak) не создается автоматически

**Симптомы:**
- Blueprint применяется без ошибок
- Applications и Providers созданы
- Но OAuth Source отсутствует

**Причина:**
Возможно, Keycloak еще не был готов когда blueprint применялся, или была ошибка в blueprint.

**Решение:**

Создайте OAuth Source вручную:

```bash
docker compose exec -T authentik_server ak shell <<'EOF'
from authentik.sources.oauth.models import OAuthSource
from authentik.flows.models import Flow

# Получаем flows
auth_flow = Flow.objects.get(slug='default-source-authentication')
enroll_flow = Flow.objects.get(slug='default-source-enrollment')

# Создаем OAuth Source
source, created = OAuthSource.objects.update_or_create(
    slug='keycloak',
    defaults={
        'name': 'Keycloak',
        'enabled': True,
        'authentication_flow': auth_flow,
        'enrollment_flow': enroll_flow,
        'user_matching_mode': 'email_link',
        'user_path_template': 'goauthentik.io/sources/%(slug)s',
        'provider_type': 'openidconnect',
        'consumer_key': 'authentik',
        'consumer_secret': 'authentik-secret-change-me-in-production',
        'oidc_well_known_url': 'http://keycloak:8080/realms/reports-realm/.well-known/openid-configuration',
        'oidc_jwks_url': 'http://keycloak:8080/realms/reports-realm/protocol/openid-connect/certs',
        'additional_scopes': 'openid profile email',
    }
)

print(f"OAuth Source {'created' if created else 'updated'}: {source.name}")
EOF
```

### Пароль admin слишком простой

**Симптомы:**
- Ошибка при смене пароля: "This password is too short. It must contain at least 8 characters."
- Ошибка: "This password is too common."

**Причина:**
Django требует сложные пароли (минимум 8 символов, не слишком простые).

**Решение:**

Используйте более сложный пароль через shell:

```bash
docker compose exec -T authentik_server ak shell <<'EOF'
from authentik.core.models import User
user = User.objects.get(username='akadmin')
user.set_password('Admin123!@#')
user.save()
print(f"Password changed for {user.username}")
EOF
```

### "Client ID Error" на фронтенде

**Симптомы:**
- Фронтенд показывает "The client identifier (client_id) is missing or invalid"
- OAuth flow не работает

**Причина:**
Application или OAuth2 Provider не созданы в Authentik.

**Решение:**

1. Проверьте, что Application существует:
```bash
docker compose exec -T authentik_server ak shell <<'EOF'
from authentik.core.models import Application
apps = Application.objects.all()
for app in apps:
    print(f"  - {app.name} (slug: {app.slug})")
EOF
```

2. Если нет, примените blueprint:
```bash
docker compose exec authentik_server ak apply_blueprint /blueprints/custom/initial-setup.yaml
```

### Permission denied: '/media/public'

**Симптомы:**
- Authentik контейнеры не запускаются
- Ошибка в логах: `PermissionError: [Errno 13] Permission denied: '/media/public'`

**Причина:**
Проблемы с правами доступа к bind mounts.

**Решение:**

Используйте Docker volumes вместо bind mounts (уже исправлено в docker-compose.yaml):

```yaml
volumes:
  - authentik_media:/media
  - authentik_templates:/templates
```

И определите volumes:

```yaml
volumes:
  authentik_media:
    driver: local
  authentik_templates:
    driver: local
```

## Проблемы с Keycloak

### Realm не импортируется

**Симптомы:**
- Keycloak запускается, но realm `reports-realm` отсутствует
- Клиенты не созданы

**Причина:**
Файл realm-export.json не смонтирован или поврежден.

**Решение:**

1. Проверьте, что файл существует:
```bash
ls -la keycloak/realm-export.json
```

2. Проверьте, что volume смонтирован:
```bash
docker compose exec keycloak ls -la /opt/keycloak/data/import/
```

3. Пересоздайте Keycloak:
```bash
docker compose down -v keycloak keycloak_db
docker compose up -d keycloak
```

### Клиент authentik не найден

**Симптомы:**
- Authentik не может подключиться к Keycloak
- Ошибка "invalid_client"

**Причина:**
Клиент `authentik` не создан в Keycloak или секреты не совпадают.

**Решение:**

1. Проверьте клиента в Keycloak Admin Console (http://localhost:8080)
2. Убедитесь, что Client Secret совпадает в:
   - `keycloak/realm-export.json`
   - `authentik-blueprints/initial-setup.yaml`
   - Должен быть: `authentik-secret-change-me-in-production`

## Проблемы с Frontend

### Фронтенд не перенаправляет на Authentik

**Симптомы:**
- Кнопка "Войти через Authentik" не работает
- Нет редиректа на Authentik

**Причина:**
Неправильные настройки в `App.tsx` или фронтенд не запущен.

**Решение:**

1. Проверьте константы в `bionicpro-frontend/src/App.tsx`:
```typescript
const AUTHENTIK_URL = 'http://localhost:9000'
const CLIENT_ID = 'bionicpro-frontend'
const REDIRECT_URI = 'http://localhost:5173/callback'
```

2. Запустите фронтенд:
```bash
cd bionicpro-frontend
npm install
npm run dev
```

### CORS ошибки

**Симптомы:**
- Ошибки в консоли браузера: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Причина:**
Backend не настроен для CORS или неправильные origins.

**Решение:**

Проверьте CORS настройки в `reports_backend/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:9000",  # Authentik
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Общие проблемы

### Контейнеры не запускаются

**Решение:**

```bash
# Проверьте статус
docker compose ps

# Проверьте логи
docker compose logs <service_name>

# Пересоздайте контейнеры
docker compose down -v
docker compose up -d
```

### База данных повреждена

**Решение:**

```bash
# Полная очистка и пересоздание
docker compose down -v
docker volume rm $(docker volume ls -q | grep architecture-bionicpro)
docker compose up -d
```

⚠️ **ВНИМАНИЕ**: Это удалит все данные!

### Порты заняты

**Симптомы:**
- Ошибка: "port is already allocated"

**Решение:**

```bash
# Найдите процесс, использующий порт
sudo lsof -i :9000

# Или измените порт в docker-compose.yaml
ports:
  - "9001:9000"  # Используйте другой внешний порт
```

## Проверка системы

### Быстрая проверка всех сервисов

```bash
./verify_setup.sh
```

### Проверка отдельных компонентов

```bash
# Keycloak
curl http://localhost:8080/realms/reports-realm/.well-known/openid-configuration

# Authentik
curl http://localhost:9000/api/v3/

# Frontend
curl http://localhost:5173

# Backend
curl http://localhost:3001/health  # если есть health endpoint
```

## Логи

### Просмотр логов

```bash
# Все сервисы
docker compose logs -f

# Конкретный сервис
docker compose logs -f authentik_server
docker compose logs -f keycloak

# Последние N строк
docker compose logs --tail=100 authentik_server

# Поиск ошибок
docker compose logs authentik_server | grep -i error
```

## Восстановление после сбоя

### Полное восстановление системы

```bash
# 1. Остановите все сервисы
docker compose down -v

# 2. Очистите volumes (опционально, удалит все данные)
docker volume prune

# 3. Запустите заново
docker compose up -d

# 4. Дождитесь готовности всех сервисов
docker compose ps

# 5. Примените blueprint
docker compose exec authentik_server ak apply_blueprint /blueprints/custom/initial-setup.yaml

# 6. Создайте OAuth Source вручную (если нужно)
# См. раздел "OAuth Source не создается автоматически"

# 7. Добавьте source к identification stage
# См. раздел "Кнопка Keycloak не появляется"
```

## Получение помощи

Если проблема не решена:

1. Проверьте логи всех сервисов
2. Проверьте документацию:
   - `README.md` - Общая информация
   - `CONFIGURATION.md` - Детали конфигурации
   - `TEST_SETUP.md` - Проверка настройки
   - `CREDENTIALS.md` - Учетные данные
3. Проверьте официальную документацию:
   - [Authentik Docs](https://goauthentik.io/docs/)
   - [Keycloak Docs](https://www.keycloak.org/documentation)
