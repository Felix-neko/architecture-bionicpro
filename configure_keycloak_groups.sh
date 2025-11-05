#!/bin/bash
# Скрипт для настройки Keycloak: добавление mapper для групп в userinfo

set -e

KEYCLOAK_URL="http://localhost:8080"
REALM="reports-realm"
CLIENT_ID="authentik"

echo "=== Настройка Keycloak для возврата групп в userinfo ==="

# Получаем admin токен
echo "1. Получаем admin токен..."
ADMIN_TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
    echo "✗ Не удалось получить admin токен"
    exit 1
fi
echo "✓ Admin токен получен"

# Получаем ID клиента authentik
echo "2. Получаем ID клиента authentik..."
CLIENT_UUID=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM}/clients" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" | jq -r ".[] | select(.clientId==\"${CLIENT_ID}\") | .id")

if [ -z "$CLIENT_UUID" ] || [ "$CLIENT_UUID" = "null" ]; then
    echo "✗ Клиент authentik не найден"
    exit 1
fi
echo "✓ Клиент authentik найден: ${CLIENT_UUID}"

# Проверяем, есть ли уже mapper для групп
echo "3. Проверяем существующие mappers..."
EXISTING_MAPPER=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}/protocol-mappers/models" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" | jq -r '.[] | select(.name=="groups") | .id')

if [ ! -z "$EXISTING_MAPPER" ] && [ "$EXISTING_MAPPER" != "null" ]; then
    echo "✓ Mapper для групп уже существует, удаляем старый..."
    curl -s -X DELETE "${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}/protocol-mappers/models/${EXISTING_MAPPER}" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}"
fi

# Создаем mapper для групп
echo "4. Создаем mapper для групп..."
curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${CLIENT_UUID}/protocol-mappers/models" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "groups",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-group-membership-mapper",
    "consentRequired": false,
    "config": {
      "full.path": "false",
      "id.token.claim": "true",
      "access.token.claim": "true",
      "userinfo.token.claim": "true",
      "claim.name": "groups"
    }
  }'

echo "✓ Mapper для групп создан"

echo ""
echo "=== Настройка Keycloak завершена успешно ==="
echo "Теперь Keycloak будет возвращать группы пользователя в userinfo endpoint"
