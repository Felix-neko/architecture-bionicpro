# Руководство по запуску E2E тестов

## 🎯 Цель

Этот документ описывает, как подготовить окружение и запустить End-to-End тесты для BionicPro.

## ⚠️ ВАЖНО: Подготовка перед запуском тестов

### 1. Убедитесь, что пользователь существует в Keycloak

Тесты используют учетные данные:
- **Username**: `user1`
- **Password**: `password123`

**Этот пользователь ДОЛЖЕН существовать в Keycloak!**

#### Как создать пользователя в Keycloak:

1. Откройте Keycloak Admin Console: http://localhost:8080
2. Войдите как admin (admin/admin)
3. Выберите realm `reports-realm`
4. Перейдите в **Users** → **Add user**
5. Заполните:
   - Username: `user1`
   - Email: `user1@example.com` (опционально)
   - First Name: `User` (опционально)
   - Last Name: `One` (опционально)
6. Нажмите **Create**
7. Перейдите на вкладку **Credentials**
8. Установите пароль:
   - Password: `password123`
   - Password Confirmation: `password123`
   - Temporary: **OFF** (выключить!)
9. Нажмите **Set Password**

### 2. Запустите все необходимые сервисы

#### Docker сервисы (Keycloak, Authentik, PostgreSQL, Redis):
```bash
docker compose up -d
```

Проверьте, что все сервисы запущены:
```bash
docker compose ps
```

Все сервисы должны быть в состоянии `Up` или `healthy`.

#### Frontend (из WebStorm или терминала):
```bash
cd bionicpro-frontend
npm install  # только первый раз
npm run dev
```

Frontend должен быть доступен на http://localhost:5173

#### Backend:
```bash
cd reports_backend
python main.py
```

Backend должен быть доступен на http://0.0.0.0:3001

### 3. Проверьте доступность сервисов

Выполните быструю проверку:
```bash
# Frontend
curl http://localhost:5173

# Backend
curl http://0.0.0.0:3001/
# Должен вернуть: {"detail":"Not Found"}

# Authentik
curl http://localhost:9000

# Keycloak
curl http://localhost:8080
```

## 🚀 Запуск тестов

### Установка зависимостей (только первый раз):

```bash
# Установить Python зависимости
uv sync

# Установить браузеры для Playwright
uv run playwright install chromium
```

### Запуск всех тестов:

```bash
uv run pytest tests/test_e2e_auth.py -v
```

### Запуск конкретного набора тестов:

```bash
# Только проверка доступности сервисов
uv run pytest tests/test_e2e_auth.py::TestServiceAvailability -v

# Только тесты авторизации
uv run pytest tests/test_e2e_auth.py::TestAuthenticationFlow -v

# Только тесты функций после авторизации
uv run pytest tests/test_e2e_auth.py::TestAuthenticatedFeatures -v

# Полный E2E сценарий
uv run pytest tests/test_e2e_auth.py::TestFullE2EScenario -v
```

### Запуск с выводом print():

```bash
uv run pytest tests/test_e2e_auth.py -v -s
```

## 🐛 Отладка

### Тесты падают с "Connection refused"

**Проблема**: Один или несколько сервисов не запущены.

**Решение**: 
1. Проверьте, что все сервисы запущены (см. раздел "Запустите все необходимые сервисы")
2. Pytest автоматически проверит доступность сервисов перед запуском тестов и покажет, какие сервисы недоступны

### Тесты падают с "Timeout exceeded" на странице авторизации

**Проблема**: Пользователь `user1` не существует в Keycloak или пароль неверный.

**Решение**:
1. Создайте пользователя `user1` в Keycloak (см. раздел "Как создать пользователя в Keycloak")
2. Убедитесь, что пароль `password123` установлен и **Temporary** выключен

### Нужно увидеть, что происходит в браузере

Измените в `tests/conftest.py`:
```python
browser = playwright_instance.chromium.launch(
    headless=False,  # Изменить на False
    slow_mo=1000,    # Добавить задержку между действиями (в мс)
)
```

### Скриншоты при ошибках

Тесты автоматически сохраняют скриншот в `/tmp/auth_error.png` при ошибках авторизации.

## 📊 Ожидаемые результаты

При успешном прохождении всех тестов вы должны увидеть:

```
======================================================================
Проверка доступности сервисов перед запуском тестов...
======================================================================
✓ Frontend     доступен на http://localhost:5173
✓ Backend      доступен на http://0.0.0.0:3001
✓ Authentik    доступен на http://localhost:9000
======================================================================
✓ Все сервисы доступны. Запуск тестов...
======================================================================

======================== test session starts =========================
collected 6 items

tests/test_e2e_auth.py::TestServiceAvailability::test_frontend_is_available PASSED
tests/test_e2e_auth.py::TestServiceAvailability::test_backend_is_available PASSED
tests/test_e2e_auth.py::TestAuthenticationFlow::test_login_flow_with_authentik PASSED
tests/test_e2e_auth.py::TestAuthenticatedFeatures::test_frontend_shows_content_after_redirect PASSED
tests/test_e2e_auth.py::TestAuthenticatedFeatures::test_reports_button_shows_jwt_content PASSED
tests/test_e2e_auth.py::TestFullE2EScenario::test_complete_user_journey PASSED

========================= 6 passed in XX.XXs =========================
```

## 🔧 Изменение учетных данных

Если вы хотите использовать другого пользователя, измените в `tests/conftest.py`:

```python
@pytest.fixture(scope="session")
def test_user_credentials() -> dict:
    return {
        "username": "your_username",  # Измените здесь
        "password": "your_password"   # Измените здесь
    }
```

## 📚 Дополнительная документация

- [tests/README.md](tests/README.md) - Подробная документация по тестам
- [pytest.ini](pytest.ini) - Конфигурация pytest
- [tests/conftest.py](tests/conftest.py) - Фикстуры и настройки
- [tests/test_e2e_auth.py](tests/test_e2e_auth.py) - Сами тесты

## ❓ Часто задаваемые вопросы

### Q: Можно ли запустить тесты без Docker?
**A**: Нет, тесты требуют Authentik и Keycloak, которые запускаются в Docker.

### Q: Можно ли запустить тесты в CI/CD?
**A**: Да, но нужно будет:
1. Запустить все сервисы в Docker
2. Дождаться их полной готовности
3. Создать пользователя в Keycloak программно
4. Запустить тесты

### Q: Почему тесты медленные?
**A**: E2E тесты по своей природе медленные, так как они:
- Запускают реальный браузер
- Ждут загрузки страниц
- Выполняют реальные HTTP запросы
- Проходят через полный процесс авторизации

Типичное время выполнения всех тестов: 30-60 секунд.

### Q: Можно ли запускать тесты параллельно?
**A**: Да, но нужно установить `pytest-xdist`:
```bash
uv add pytest-xdist
uv run pytest tests/test_e2e_auth.py -n auto
```

Однако, некоторые тесты могут конфликтовать из-за общего состояния в Authentik/Keycloak.
