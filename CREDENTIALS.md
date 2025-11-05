# Учетные данные для доступа к сервисам

## 🔐 Важно!

Это учетные данные для **development окружения**. 
В production обязательно замените все пароли на сложные!

## Сервисы

### Keycloak (http://localhost:8080)
- **Username**: `admin`
- **Password**: `admin`
- **Описание**: Администратор Keycloak realm

### Authentik (http://localhost:9000)
- **Username**: `akadmin`
- **Password**: `Admin123!@#`
- **Описание**: Администратор Authentik

⚠️ **ВАЖНО**: Пароль был изменен с `admin` на `Admin123!@#` из-за требований безопасности Django.

### phpLDAPadmin (http://localhost:8081)
- **Login DN**: `cn=admin,dc=zambia,dc=local`
- **Password**: `admin123`
- **Описание**: Администратор LDAP

### Тестовые пользователи Keycloak

#### User 1
- **Username**: `user1`
- **Password**: `password123`
- **Email**: `user1@example.com`
- **Roles**: `users`

#### Admin 1
- **Username**: `admin1`
- **Password**: `admin123`
- **Email**: `admin1@example.com`
- **Roles**: `administrators`, `users`

#### Prothetic 1
- **Username**: `prothetic1`
- **Password**: `prothetic123`
- **Email**: `prothetic1@example.com`
- **Roles**: `prothetic_users`

## OAuth Secrets

### Keycloak Client Secrets

#### reports-api
- **Client ID**: `reports-api`
- **Client Secret**: `oNwoLQdvJAvRcL89SydqCWCe5ry1jMgq`

#### authentik
- **Client ID**: `authentik`
- **Client Secret**: `authentik-secret-change-me-in-production`

⚠️ **ВАЖНО**: Client Secret для `authentik` должен совпадать в:
- `keycloak/realm-export.json`
- `authentik-blueprints/initial-setup.yaml`

### Authentik OAuth2

#### BionicPro Frontend
- **Client ID**: `bionicpro-frontend`
- **Client Type**: Public (нет секрета)
- **Redirect URIs**: 
  - `http://localhost:5173/callback`
  - `http://localhost:5173/*`

## Database Credentials

### PostgreSQL (Keycloak)
- **Host**: `localhost:5433`
- **Database**: `keycloak_db`
- **Username**: `keycloak_user`
- **Password**: `keycloak_password`

### PostgreSQL (Authentik)
- **Host**: `localhost:5434`
- **Database**: `authentik`
- **Username**: `authentik`
- **Password**: `authentik_password`

## Authentik Internal

### Secret Key
```
AUTHENTIK_SECRET_KEY=change-me-to-a-random-string-at-least-50-chars-long-please
```

⚠️ **ВАЖНО**: Замените на случайную строку длиной минимум 50 символов в production!

Генерация:
```bash
openssl rand -base64 50
```

### Bootstrap Token
```
AUTHENTIK_BOOTSTRAP_TOKEN=bootstrap-token-change-me
```

## 🔒 Production Security Checklist

Перед деплоем в production:

- [ ] Замените все пароли на сложные (минимум 12 символов, буквы, цифры, спецсимволы)
- [ ] Сгенерируйте новый `AUTHENTIK_SECRET_KEY`
- [ ] Замените `authentik-secret-change-me-in-production` на случайный секрет
- [ ] Замените `reports-api` client secret
- [ ] Обновите пароли баз данных
- [ ] Используйте secrets management (Vault, AWS Secrets Manager и т.д.)
- [ ] Включите HTTPS для всех сервисов
- [ ] Настройте firewall rules
- [ ] Включите audit logging
- [ ] Настройте регулярную ротацию паролей

## Генерация безопасных паролей

```bash
# Случайный пароль (16 символов)
openssl rand -base64 16

# Случайный пароль (32 символа)
openssl rand -base64 32

# Случайный hex (64 символа)
openssl rand -hex 32
```

## Хранение секретов

### Development
- Используйте `.env` файл (добавлен в `.gitignore`)
- Не коммитьте секреты в Git

### Production
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault
- Google Secret Manager
- Kubernetes Secrets (с шифрованием at rest)

## Восстановление доступа

### Если забыли пароль Authentik

```bash
# Сброс пароля через Django shell
docker compose exec -T authentik_server ak shell <<'EOF'
from authentik.core.models import User
user = User.objects.get(username='akadmin')
user.set_password('НовыйПароль123!@#')
user.save()
print(f"Password changed for {user.username}")
EOF
```

### Если забыли пароль Keycloak

```bash
# Пересоздайте контейнер с новым паролем
docker compose down -v keycloak keycloak_db
# Обновите KEYCLOAK_ADMIN_PASSWORD в docker-compose.yaml
docker compose up -d keycloak
```

## Audit Log

Все изменения паролей логируются в:
- Authentik: Events → System Tasks
- Keycloak: Manage → Events → Admin Events
