#!/bin/bash

# Скрипт для проверки настройки Authentik и Keycloak

set -e

# Цвета
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Проверка настройки Authentik + Keycloak${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Функция для проверки HTTP endpoint
check_http() {
    local name=$1
    local url=$2
    local expected=$3
    
    echo -n "Проверка $name... "
    
    if response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null); then
        if echo "$response" | grep -qE "$expected"; then
            echo -e "${GREEN}✓${NC} ($response)"
            return 0
        else
            echo -e "${RED}✗${NC} (получен $response, ожидался $expected)"
            return 1
        fi
    else
        echo -e "${RED}✗${NC} (недоступен)"
        return 1
    fi
}

# Функция для проверки JSON response
check_json() {
    local name=$1
    local url=$2
    local jq_filter=$3
    local expected=$4
    
    echo -n "Проверка $name... "
    
    if response=$(curl -s "$url" 2>/dev/null); then
        if result=$(echo "$response" | jq -r "$jq_filter" 2>/dev/null); then
            if [ "$result" = "$expected" ]; then
                echo -e "${GREEN}✓${NC} ($result)"
                return 0
            else
                echo -e "${YELLOW}⚠${NC} (получен: $result, ожидался: $expected)"
                return 1
            fi
        else
            echo -e "${RED}✗${NC} (ошибка парсинга JSON)"
            return 1
        fi
    else
        echo -e "${RED}✗${NC} (недоступен)"
        return 1
    fi
}

echo -e "${BLUE}1. Проверка Docker сервисов${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Проверка статуса контейнеров
if docker compose ps --format json 2>/dev/null | jq -r '.[] | select(.Service == "keycloak") | .Health' | grep -q "healthy"; then
    echo -e "${GREEN}✓${NC} Keycloak: healthy"
else
    echo -e "${RED}✗${NC} Keycloak: not healthy"
fi

if docker compose ps --format json 2>/dev/null | jq -r '.[] | select(.Service == "authentik_server") | .Health' | grep -q "healthy"; then
    echo -e "${GREEN}✓${NC} Authentik Server: healthy"
else
    echo -e "${RED}✗${NC} Authentik Server: not healthy"
fi

if docker compose ps --format json 2>/dev/null | jq -r '.[] | select(.Service == "authentik_worker") | .Health' | grep -q "healthy"; then
    echo -e "${GREEN}✓${NC} Authentik Worker: healthy"
else
    echo -e "${RED}✗${NC} Authentik Worker: not healthy"
fi

echo ""
echo -e "${BLUE}2. Проверка Keycloak${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Проверка Keycloak realm
check_json "Keycloak realm" \
    "http://localhost:8080/realms/reports-realm/.well-known/openid-configuration" \
    ".issuer" \
    "http://localhost:8080/realms/reports-realm"

# Проверка JWKS endpoint
check_http "Keycloak JWKS" \
    "http://localhost:8080/realms/reports-realm/protocol/openid-connect/certs" \
    "200"

echo ""
echo -e "${BLUE}3. Проверка Authentik${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Проверка Authentik API
check_http "Authentik API" \
    "http://localhost:9000/api/v3/" \
    "200"

# Проверка Authentik UI
check_http "Authentik UI" \
    "http://localhost:9000/" \
    "200|302|303"

echo ""
echo -e "${BLUE}4. Проверка конфигурационных файлов${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Проверка Keycloak realm export
if [ -f "keycloak/realm-export.json" ]; then
    echo -n "Проверка keycloak/realm-export.json... "
    if jq -e '.clients[] | select(.clientId == "authentik")' keycloak/realm-export.json > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} (клиент authentik найден)"
    else
        echo -e "${RED}✗${NC} (клиент authentik не найден)"
    fi
else
    echo -e "${RED}✗${NC} keycloak/realm-export.json не найден"
fi

# Проверка Authentik blueprint
if [ -f "authentik-blueprints/initial-setup.yaml" ]; then
    echo -n "Проверка authentik-blueprints/initial-setup.yaml... "
    if grep -q "bionicpro-frontend" authentik-blueprints/initial-setup.yaml; then
        echo -e "${GREEN}✓${NC} (blueprint содержит bionicpro-frontend)"
    else
        echo -e "${RED}✗${NC} (bionicpro-frontend не найден в blueprint)"
    fi
else
    echo -e "${RED}✗${NC} authentik-blueprints/initial-setup.yaml не найден"
fi

# Проверка docker-compose.yaml
if [ -f "docker-compose.yaml" ]; then
    echo -n "Проверка docker-compose.yaml... "
    if grep -q "authentik-blueprints:/blueprints/custom" docker-compose.yaml; then
        echo -e "${GREEN}✓${NC} (blueprints подключены)"
    else
        echo -e "${RED}✗${NC} (blueprints не подключены)"
    fi
else
    echo -e "${RED}✗${NC} docker-compose.yaml не найден"
fi

echo ""
echo -e "${BLUE}5. Проверка Blueprint в контейнере${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Проверка, что blueprint файл доступен в контейнере
echo -n "Проверка доступности blueprint в контейнере... "
if docker compose exec -T authentik_server test -f /blueprints/custom/initial-setup.yaml 2>/dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC} (файл не найден в контейнере)"
fi

# Проверка логов blueprint
echo -n "Проверка применения blueprint... "
if docker compose logs authentik_worker 2>/dev/null | grep -q "blueprints_discovery"; then
    echo -e "${GREEN}✓${NC} (blueprint discovery выполнен)"
else
    echo -e "${YELLOW}⚠${NC} (blueprint discovery не найден в логах)"
fi

echo ""
echo -e "${BLUE}6. Проверка подключения Authentik → Keycloak${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Проверка, что Authentik может достучаться до Keycloak
echo -n "Проверка доступности Keycloak из Authentik... "
if docker compose exec -T authentik_server curl -s -f http://keycloak:8080/realms/reports-realm/.well-known/openid-configuration > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC} (Keycloak недоступен из Authentik)"
fi

echo ""
echo -e "${BLUE}7. Проверка секретов${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Проверка совпадения секретов
echo -n "Проверка совпадения client secret... "
keycloak_secret=$(jq -r '.clients[] | select(.clientId == "authentik") | .secret' keycloak/realm-export.json 2>/dev/null)
authentik_secret=$(grep "consumer_secret:" authentik-blueprints/initial-setup.yaml | awk '{print $2}' 2>/dev/null)

if [ "$keycloak_secret" = "$authentik_secret" ]; then
    echo -e "${GREEN}✓${NC} (секреты совпадают)"
else
    echo -e "${RED}✗${NC} (секреты НЕ совпадают!)"
    echo "  Keycloak: $keycloak_secret"
    echo "  Authentik: $authentik_secret"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Итоговая информация${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📋 Доступные сервисы:"
echo "   • Keycloak:        http://localhost:8080 (admin / admin)"
echo "   • Authentik:       http://localhost:9000 (akadmin@localhost / admin)"
echo "   • Frontend:        http://localhost:5173"
echo "   • Backend:         http://localhost:3001"
echo "   • phpLDAPadmin:    http://localhost:8081"
echo ""
echo "📚 Документация:"
echo "   • Быстрый старт:   ./QUICK_START.md"
echo "   • Проверка:        ./TEST_SETUP.md"
echo "   • Конфигурация:    ./CONFIGURATION.md"
echo "   • Завершение:      ./SETUP_COMPLETE.md"
echo ""
echo "🚀 Следующие шаги:"
echo "   1. Откройте http://localhost:9000 и войдите в Authentik"
echo "   2. Проверьте Applications → Applications (должны быть BionicPro Frontend и Backend)"
echo "   3. Проверьте Directory → Federation (должен быть Keycloak source)"
echo "   4. Запустите фронтенд: cd bionicpro-frontend && npm run dev"
echo "   5. Откройте http://localhost:5173 и протестируйте вход"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
