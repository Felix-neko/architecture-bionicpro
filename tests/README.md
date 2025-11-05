# E2E Тесты для BionicPro

## 📋 Описание

Набор End-to-End тестов для проверки работы веб-приложения BionicPro, включая:
- Проверку доступности фронтенда и бэкенда
- Полный процесс авторизации через Authentik/Keycloak
- Проверку отображения контента после авторизации
- Тестирование API endpoints

## 🛠️ Технологии

- **Python 3.12+**
- **pytest** - фреймворк для тестирования
- **Playwright** - автоматизация браузера
- **requests** - HTTP запросы

## 📦 Установка зависимостей

```bash
# Установка Python зависимостей
uv sync

# Установка браузеров для Playwright
playwright install chromium
```

## 🚀 Запуск тестов

### Предварительные требования

Перед запуском тестов убедитесь, что:
1. ✅ Все Docker сервисы запущены (`docker compose up -d`)
2. ✅ Фронтенд запущен на `localhost:5173`
3. ✅ Бэкенд запущен на `localhost:3001`
4. ✅ Пользователь `user1` с паролем `password123` существует в Keycloak

### Запуск всех тестов

```bash
# Из корневой директории проекта
pytest

# Или с явным указанием директории
pytest tests/
```

### Запуск конкретного теста

```bash
# Запустить только тесты доступности сервисов
pytest tests/test_e2e_auth.py::TestServiceAvailability

# Запустить только тесты авторизации
pytest tests/test_e2e_auth.py::TestAuthenticationFlow

# Запустить только тесты функций после авторизации
pytest tests/test_e2e_auth.py::TestAuthenticatedFeatures

# Запустить полный E2E сценарий
pytest tests/test_e2e_auth.py::TestFullE2EScenario
```

### Запуск с дополнительными опциями

```bash
# Показать print() в консоли
pytest -s

# Остановиться на первой ошибке
pytest -x

# Показать детальный вывод
pytest -v

# Запустить в headed режиме (с GUI браузера) для отладки
# Измените headless=False в conftest.py
```

## 📝 Структура тестов

```
tests/
├── __init__.py              # Пустой файл для Python пакета
├── conftest.py              # Конфигурация pytest и фикстуры
├── test_e2e_auth.py         # Основные E2E тесты
└── README.md                # Эта документация
```

## 🧪 Описание тестов

### TestServiceAvailability
Проверяет доступность сервисов:
- `test_frontend_is_available` - проверяет, что фронтенд отвечает
- `test_backend_is_available` - проверяет, что бэкенд отвечает с корректным ответом

### TestAuthenticationFlow
Тестирует процесс авторизации:
- `test_login_flow_with_authentik` - полный процесс входа через Authentik/Keycloak

### TestAuthenticatedFeatures
Тестирует функции после авторизации:
- `test_frontend_shows_content_after_redirect` - проверяет отображение контента
- `test_reports_button_shows_jwt_content` - проверяет работу кнопки /reports

### TestFullE2EScenario
Полный сквозной сценарий:
- `test_complete_user_journey` - весь путь пользователя от начала до конца

## 🔧 Конфигурация

### Фикстуры (conftest.py)

- `playwright_instance` - экземпляр Playwright для всей сессии
- `browser` - браузер Chromium для всей сессии
- `context` - контекст браузера для каждого теста (изолированные cookies/storage)
- `page` - страница браузера для каждого теста
- `frontend_url` - URL фронтенда (по умолчанию `http://localhost:5173`)
- `backend_url` - URL бэкенда (по умолчанию `http://0.0.0.0:3001`)
- `authentik_url` - URL Authentik (по умолчанию `http://localhost:9000`)
- `test_user_credentials` - учетные данные тестового пользователя

### Изменение конфигурации

Чтобы изменить URL или учетные данные, отредактируйте соответствующие фикстуры в `conftest.py`.

## 🐛 Отладка

### Запуск с видимым браузером

Измените в `conftest.py`:
```python
browser = playwright_instance.chromium.launch(
    headless=False,  # Изменить на False
    slow_mo=1000,    # Добавить задержку между действиями (в мс)
)
```

### Скриншоты при ошибках

Добавьте в тест:
```python
try:
    # Ваш тестовый код
    pass
except Exception as e:
    page.screenshot(path="error_screenshot.png")
    raise
```

### Просмотр логов браузера

```python
page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
```

## ⚠️ Известные проблемы

1. **Таймауты** - если тесты падают по таймауту, увеличьте значения в `conftest.py`
2. **Селекторы** - если UI изменился, может потребоваться обновить селекторы в тестах
3. **Порядок тестов** - некоторые тесты могут зависеть от состояния (используйте фикстуры)

## 📊 Результаты тестов

После запуска pytest покажет:
- ✅ Количество пройденных тестов
- ❌ Количество упавших тестов
- ⚠️ Пропущенные тесты
- 📈 Время выполнения

Пример вывода:
```
======================== test session starts =========================
collected 7 items

tests/test_e2e_auth.py::TestServiceAvailability::test_frontend_is_available PASSED
tests/test_e2e_auth.py::TestServiceAvailability::test_backend_is_available PASSED
tests/test_e2e_auth.py::TestAuthenticationFlow::test_login_flow_with_authentik PASSED
tests/test_e2e_auth.py::TestAuthenticatedFeatures::test_frontend_shows_content_after_redirect PASSED
tests/test_e2e_auth.py::TestAuthenticatedFeatures::test_reports_button_shows_jwt_content PASSED
tests/test_e2e_auth.py::TestFullE2EScenario::test_complete_user_journey PASSED

========================= 6 passed in 45.23s =========================
```

## 🤝 Вклад

При добавлении новых тестов:
1. Следуйте существующей структуре
2. Добавляйте подробные комментарии
3. Используйте фикстуры для переиспользования кода
4. Группируйте связанные тесты в классы

## 📚 Дополнительные ресурсы

- [Playwright Documentation](https://playwright.dev/python/)
- [pytest Documentation](https://docs.pytest.org/)
- [Playwright Best Practices](https://playwright.dev/python/docs/best-practices)
