#!/bin/bash

# Скрипт для проверки готовности всех сервисов

echo "🔍 Проверка состояния сервисов..."
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция проверки HTTP сервиса
check_http() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "$expected_code"; then
        echo -e "${GREEN}✓${NC} $name доступен ($url)"
        return 0
    else
        echo -e "${RED}✗${NC} $name недоступен ($url)"
        return 1
    fi
}

# Функция проверки TCP порта
check_tcp() {
    local name=$1
    local host=$2
    local port=$3
    
    if timeout 2 bash -c "echo > /dev/tcp/$host/$port" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $name доступен ($host:$port)"
        return 0
    else
        echo -e "${RED}✗${NC} $name недоступен ($host:$port)"
        return 1
    fi
}

# Проверка Docker сервисов
echo "📦 Docker сервисы:"
docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || echo -e "${RED}✗${NC} Docker Compose не запущен"
echo ""

# Проверка HTTP сервисов
echo "🌐 HTTP сервисы:"
check_http "Keycloak" "http://localhost:8080" "200\|303"
check_http "Authentik" "http://localhost:9000" "200\|302\|303"
check_http "phpLDAPadmin" "http://localhost:8081" "200"
echo ""

# Проверка TCP портов
echo "🔌 TCP порты:"
check_tcp "PostgreSQL (Keycloak)" "localhost" "5433"
check_tcp "PostgreSQL (Authentik)" "localhost" "5434"
check_tcp "OpenLDAP" "localhost" "389"
echo ""

# Проверка приложений
echo "🚀 Приложения:"
check_http "Backend" "http://localhost:3001/reports" "401\|200"
check_http "Frontend" "http://localhost:5173" "200"
echo ""

# Проверка Keycloak realm
echo "🔐 Keycloak realm:"
if curl -s "http://localhost:8080/realms/reports-realm/.well-known/openid-configuration" | grep -q "issuer"; then
    echo -e "${GREEN}✓${NC} Realm 'reports-realm' настроен"
else
    echo -e "${YELLOW}⚠${NC} Realm 'reports-realm' не найден или не настроен"
fi
echo ""

# Проверка Authentik API
echo "🔑 Authentik API:"
if curl -s "http://localhost:9000/api/v3/" | grep -q "version"; then
    echo -e "${GREEN}✓${NC} Authentik API доступен"
else
    echo -e "${YELLOW}⚠${NC} Authentik API недоступен"
fi
echo ""

# Итоговая информация
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Полезные ссылки:"
echo "   • Frontend:        http://localhost:5173"
echo "   • Backend:         http://localhost:3001"
echo "   • Authentik:       http://localhost:9000"
echo "   • Keycloak:        http://localhost:8080"
echo "   • phpLDAPadmin:    http://localhost:8081"
echo ""
echo "🔑 Учетные данные по умолчанию:"
echo "   • Keycloak:        admin / admin"
echo "   • Authentik:       akadmin@localhost / admin"
echo "   • phpLDAPadmin:    cn=admin,dc=zambia,dc=local / admin123"
echo ""
echo "📚 Документация:"
echo "   • Быстрый старт:   ./QUICK_START.md"
echo "   • Настройка:       ./AUTHENTIK_SETUP.md"
echo "   • Архитектура:     ./ARCHITECTURE.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
