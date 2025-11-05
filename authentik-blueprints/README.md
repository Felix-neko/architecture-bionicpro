# Authentik Blueprints

Этот каталог содержит Blueprints для автоматической настройки Authentik.

## Что такое Blueprints?

Blueprints - это декларативные конфигурационные файлы в формате YAML, которые позволяют автоматически создавать и настраивать объекты в Authentik при запуске.

## Файлы

### `initial-setup.yaml`

Основной Blueprint, который создает:

1. **OAuth Source (Keycloak)**
   - Подключение к Keycloak как провайдеру идентификации
   - Client ID: `authentik`
   - Client Secret: `authentik-secret-change-me-in-production`
   - OIDC Well-known URL: `http://keycloak:8080/realms/reports-realm/.well-known/openid-configuration`

2. **OAuth2 Provider (Frontend)**
   - Для аутентификации фронтенда
   - Client ID: `bionicpro-frontend`
   - Client Type: Public
   - Redirect URIs: `http://localhost:5173/callback`, `http://localhost:5173/*`

3. **Application (Frontend)**
   - Название: BionicPro Frontend
   - Slug: `bionicpro-frontend`
   - Launch URL: `http://localhost:5173`

4. **Proxy Provider (Backend)**
   - Для проксирования запросов к бэкенду
   - Mode: Forward Single
   - External Host: `http://localhost:3001`
   - Internal Host: `http://host.docker.internal:3001`

5. **Application (Backend)**
   - Название: BionicPro Backend
   - Slug: `bionicpro-backend`
   - Launch URL: `http://localhost:3001`

6. **Groups**
   - Administrators
   - Users

7. **Property Mappings**
   - Groups Header Mapping → `X-Authentik-Groups`
   - Email Header Mapping → `X-Authentik-Email`
   - Username Header Mapping → `X-Authentik-Username`
   - UID Header Mapping → `X-Authentik-Uid`

## Как это работает

1. При запуске Authentik автоматически сканирует директорию `/blueprints/custom`
2. Находит файлы с меткой `blueprints.goauthentik.io/instantiate: "true"`
3. Применяет конфигурацию, создавая все необходимые объекты
4. Если объект уже существует (по identifiers), он обновляется

## Применение изменений

### Автоматическое применение

Blueprints применяются автоматически при:
- Первом запуске Authentik
- Перезапуске контейнера

### Ручное применение

Если нужно применить изменения без перезапуска:

```bash
# Войдите в контейнер
docker compose exec authentik_server bash

# Примените blueprint
ak apply_blueprint /blueprints/custom/initial-setup.yaml
```

## Проверка применения

1. Откройте http://localhost:9000/if/admin
2. Войдите как `akadmin / Admin123!@#`
3. Проверьте:
   - **Directory → Federation & Social login** - должен быть Keycloak source
   - **Applications → Applications** - должны быть BionicPro Frontend и Backend
   - **Applications → Providers** - должны быть OAuth2 и Proxy провайдеры
   - **Directory → Groups** - должны быть Administrators и Users

## Настройка секретов

⚠️ **ВАЖНО**: В production замените следующие значения:

1. В `initial-setup.yaml`:
   ```yaml
   consumer_secret: authentik-secret-change-me-in-production
   ```

2. В `keycloak/realm-export.json`:
   ```json
   "secret": "authentik-secret-change-me-in-production"
   ```

Оба значения должны совпадать!

## Кастомизация

### Изменение redirect URIs

Если фронтенд работает на другом порту, измените:

```yaml
redirect_uris: |
  http://localhost:ВАШИ_ПОРТ/callback
  http://localhost:ВАШИ_ПОРТ/*
```

### Изменение backend URL

Если бэкенд работает на другом хосте/порту:

```yaml
external_host: http://localhost:ВАШИ_ПОРТ
internal_host: http://ВАШИ_ХОСТ:ВАШИ_ПОРТ
```

### Добавление дополнительных маппингов

Можно добавить свои Property Mappings для передачи дополнительных данных в заголовках:

```yaml
- model: authentik_providers_proxy.proxyprovidermapping
  id: custom-header-mapping
  identifiers:
    name: Custom Header Mapping
  attrs:
    expression: |
      return {
        "X-Custom-Header": "your_value"
      }
```

## Troubleshooting

### Blueprint не применяется

1. Проверьте логи:
   ```bash
   docker compose logs authentik_server | grep blueprint
   ```

2. Проверьте синтаксис YAML:
   ```bash
   yamllint initial-setup.yaml
   ```

3. Проверьте, что файл смонтирован:
   ```bash
   docker compose exec authentik_server ls -la /blueprints/custom/
   ```

### Ошибка "Object not found"

Если Blueprint ссылается на несуществующий объект (например, flow), убедитесь, что:
- Authentik полностью инициализирован
- Используются правильные slugs для flows

### Изменения не применяются

Blueprint применяется только если:
1. Объект не существует (создается новый)
2. Объект существует, но изменились attrs (обновляется)

Если нужно пересоздать объект:
1. Удалите его через Admin UI
2. Перезапустите Authentik

## Дополнительные ресурсы

- [Authentik Blueprints Documentation](https://goauthentik.io/docs/flow/blueprints/)
- [Blueprint Examples](https://github.com/goauthentik/authentik/tree/main/blueprints)
