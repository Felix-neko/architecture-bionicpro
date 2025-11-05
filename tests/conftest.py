"""
Конфигурация pytest для E2E тестов.
Настраивает Playwright и общие фикстуры для тестов.
"""

import pytest
import requests
from playwright.sync_api import Browser, BrowserContext, Page, Playwright, sync_playwright


@pytest.fixture(scope="session")
def playwright_instance() -> Playwright:
    """
    Создает экземпляр Playwright для всей сессии тестов.
    Автоматически закрывается после завершения всех тестов.
    """
    with sync_playwright() as playwright:
        yield playwright


@pytest.fixture(scope="session")
def browser(playwright_instance: Playwright) -> Browser:
    """
    Запускает браузер Chromium для всей сессии тестов.
    Использует headless режим по умолчанию.
    """
    browser = playwright_instance.chromium.launch(
        headless=True,  # Запуск без GUI (можно изменить на False для отладки)
        args=[
            '--disable-blink-features=AutomationControlled',  # Скрываем признаки автоматизации
        ]
    )
    yield browser
    browser.close()


@pytest.fixture(scope="function")
def context(browser: Browser) -> BrowserContext:
    """
    Создает новый контекст браузера для каждого теста.
    Контекст изолирует cookies, localStorage и другие данные между тестами.
    """
    context = browser.new_context(
        viewport={'width': 1920, 'height': 1080},  # Размер окна браузера
        locale='ru-RU',  # Локаль для браузера
        timezone_id='Europe/Moscow',  # Часовой пояс
        ignore_https_errors=True,  # Игнорируем ошибки SSL (для локальной разработки)
    )
    yield context
    context.close()


@pytest.fixture(scope="function")
def page(context: BrowserContext) -> Page:
    """
    Создает новую страницу (вкладку) для каждого теста.
    """
    page = context.new_page()
    
    # Устанавливаем таймауты для операций
    page.set_default_timeout(30000)  # 30 секунд на операции
    page.set_default_navigation_timeout(30000)  # 30 секунд на навигацию
    
    yield page
    page.close()


@pytest.fixture(scope="session")
def frontend_url() -> str:
    """URL фронтенд-сервера."""
    return "http://localhost:5173"


@pytest.fixture(scope="session")
def backend_url() -> str:
    """URL бэкенд-сервера."""
    return "http://0.0.0.0:3001"


@pytest.fixture(scope="session")
def authentik_url() -> str:
    """URL Authentik сервера."""
    return "http://localhost:9000"


@pytest.fixture(scope="session")
def test_user_credentials() -> dict:
    """
    Учетные данные тестового пользователя.
    Этот пользователь должен существовать в Keycloak.
    """
    return {
        "username": "prothetic1",
        "password": "prothetic123"
    }


def pytest_configure(config):
    """
    Проверяет доступность всех необходимых сервисов перед запуском тестов.
    Падает с понятным сообщением, если какой-то сервис не запущен.
    """
    services = {
        "Frontend": "http://localhost:5173",
        "Backend": "http://0.0.0.0:3001",
        "Authentik": "http://localhost:9000",
    }
    
    print("\n" + "="*70)
    print("Проверка доступности сервисов перед запуском тестов...")
    print("="*70)
    
    failed_services = []
    
    for service_name, url in services.items():
        try:
            response = requests.get(url, timeout=5)
            print(f"✓ {service_name:12} доступен на {url}")
        except requests.exceptions.ConnectionError:
            print(f"✗ {service_name:12} НЕ ДОСТУПЕН на {url}")
            failed_services.append((service_name, url))
        except Exception as e:
            print(f"⚠ {service_name:12} ошибка проверки: {e}")
            failed_services.append((service_name, url))
    
    if failed_services:
        print("\n" + "="*70)
        print("ОШИБКА: Не все сервисы запущены!")
        print("="*70)
        print("\nНе доступны следующие сервисы:")
        for service_name, url in failed_services:
            print(f"  - {service_name}: {url}")
        
        print("\nПожалуйста, запустите все необходимые сервисы:")
        print("  1. Frontend:  cd bionicpro-frontend && npm run dev")
        print("  2. Backend:   cd reports_backend && python main.py")
        print("  3. Docker:    docker compose up -d")
        print("\nИли запустите фронтенд из WebStorm и бэкенд вручную.")
        print("="*70 + "\n")
        
        pytest.exit("Не все сервисы доступны. Запустите их перед запуском тестов.", returncode=1)
    
    print("="*70)
    print("✓ Все сервисы доступны. Запуск тестов...")
    print("="*70 + "\n")
