"""
End-to-End тесты для веб-приложения BionicPro.
Тестирует фронтенд, бэкенд и процесс авторизации через Authentik/Keycloak.
"""

import json
import time
import pytest
import requests
from playwright.sync_api import Page, expect


class TestServiceAvailability:
    """Тесты доступности сервисов."""
    
    def test_frontend_is_available(self, frontend_url: str):
        """
        Проверяет, что фронтенд-сервер доступен и отвечает на запросы.
        """
        response = requests.get(frontend_url, timeout=10)
        assert response.status_code == 200, f"Frontend не доступен: {response.status_code}"
        print(f"✓ Frontend доступен на {frontend_url}")
    
    def test_backend_is_available(self, backend_url: str):
        """
        Проверяет, что бэкенд-сервер доступен и возвращает ожидаемый ответ.
        Корневой endpoint должен возвращать {"detail":"Not Found"}.
        """
        response = requests.get(backend_url + "/", timeout=10)
        assert response.status_code == 404, f"Backend вернул неожиданный статус: {response.status_code}"
        
        data = response.json()
        assert data.get("detail") == "Not Found", f"Backend вернул неожиданный ответ: {data}"
        print(f"✓ Backend доступен на {backend_url} и возвращает корректный ответ")


class TestAuthenticationFlow:
    """Тесты процесса авторизации через Authentik/Keycloak."""
    
    def test_login_flow_with_authentik(
        self, 
        page: Page, 
        frontend_url: str, 
        test_user_credentials: dict
    ):
        """
        Тестирует полный процесс авторизации:
        1. Открывает фронтенд
        2. Нажимает кнопку входа
        3. Авторизуется в Authentik под пользователем из Keycloak
        4. Проверяет успешный редирект обратно на фронтенд
        5. Проверяет, что пользователь авторизован
        """
        print(f"\n=== Начало теста авторизации ===")
        
        # Шаг 1: Открываем фронтенд
        print(f"1. Открываем фронтенд: {frontend_url}")
        page.goto(frontend_url)
        
        # Ждем загрузки страницы
        page.wait_for_load_state("networkidle")
        time.sleep(1)
        
        # Проверяем, что мы на странице входа
        print("2. Проверяем наличие кнопки входа")
        login_button = page.get_by_role("button", name="Войти через Authentik")
        expect(login_button).to_be_visible(timeout=10000)
        print("✓ Кнопка входа найдена")
        
        # Шаг 2: Нажимаем кнопку входа
        print("3. Нажимаем кнопку входа")
        login_button.click()
        
        # Ждем редиректа на Authentik (может быть либо /application/o/authorize/, либо /if/flow/)
        print("4. Ожидаем редирект на Authentik")
        page.wait_for_url("**/localhost:9000/**", timeout=15000)
        print(f"✓ Редирект на Authentik выполнен: {page.url}")
        
        # Ждем загрузки страницы Authentik
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        
        # Шаг 3: Проверяем, есть ли кнопка входа через Keycloak
        print("5. Ищем кнопку входа через Keycloak на странице Authentik")
        
        # Authentik может показать либо форму входа, либо кнопку для входа через Keycloak
        # Пытаемся найти кнопку Keycloak
        try:
            # Ищем кнопку с текстом "Keycloak" или ссылку на Keycloak
            keycloak_button = page.locator('a:has-text("Keycloak"), button:has-text("Keycloak")').first
            if keycloak_button.is_visible(timeout=3000):
                print("✓ Найдена кнопка входа через Keycloak, нажимаем")
                keycloak_button.click()
                page.wait_for_load_state("networkidle")
                time.sleep(2)
        except Exception as e:
            print(f"⚠ Кнопка Keycloak не найдена, возможно нужен прямой вход: {e}")
        
        # Шаг 4: Вводим учетные данные
        # Проверяем, на какой странице мы находимся (Authentik или Keycloak)
        current_url = page.url
        print(f"6. Текущий URL: {current_url}")
        
        if "keycloak" in current_url.lower() or "8080" in current_url:
            print("7. Находимся на странице Keycloak, вводим учетные данные")
            
            # Ждем загрузки формы входа Keycloak
            page.wait_for_selector('input[name="username"], input[id="username"]', timeout=10000)
            
            # Вводим username
            username_input = page.locator('input[name="username"], input[id="username"]').first
            username_input.fill(test_user_credentials["username"])
            print(f"✓ Введен username: {test_user_credentials['username']}")
            
            # Вводим password
            password_input = page.locator('input[name="password"], input[id="password"]').first
            password_input.fill(test_user_credentials["password"])
            print(f"✓ Введен password")
            
            # Нажимаем кнопку входа
            submit_button = page.locator('input[type="submit"], button[type="submit"]').first
            submit_button.click()
            print("✓ Нажата кнопка входа в Keycloak")
            
        else:
            print("7. Находимся на странице Authentik, вводим учетные данные")
            
            # Ждем загрузки формы входа Authentik
            page.wait_for_selector('input[name="uidField"], input[type="text"]', timeout=10000)
            
            # Вводим username
            username_input = page.locator('input[name="uidField"], input[type="text"]').first
            username_input.fill(test_user_credentials["username"])
            print(f"✓ Введен username: {test_user_credentials['username']}")
            
            # Нажимаем кнопку "Продолжить" или "Continue"
            try:
                continue_button = page.get_by_role("button", name="Continue")
                if continue_button.is_visible(timeout=2000):
                    continue_button.click()
                    time.sleep(1)
            except:
                pass
            
            # Вводим password
            password_input = page.locator('input[name="password"], input[type="password"]').first
            password_input.fill(test_user_credentials["password"])
            print(f"✓ Введен password")
            
            # Нажимаем кнопку входа
            submit_button = page.get_by_role("button", name="Sign in")
            submit_button.click()
            print("✓ Нажата кнопка входа в Authentik")
        
        # Ждем возврата на Authentik после входа в Keycloak
        time.sleep(3)
        print(f"7.5. После входа в Keycloak, текущий URL: {page.url}")
        
        # Проверяем, не вернулись ли мы на страницу Authentik с предложением войти
        if "localhost:9000" in page.url and "flow" in page.url:
            print("7.6. Вернулись на Authentik, ищем кнопку подтверждения входа")
            # Ищем кнопку "Войти" на русском или "Continue" на английском
            try:
                continue_button = page.get_by_role("button", name="Войти")
                if continue_button.is_visible(timeout=3000):
                    print("✓ Найдена кнопка 'Войти', нажимаем")
                    continue_button.click()
                    time.sleep(2)
            except:
                try:
                    continue_button = page.get_by_role("button", name="Continue")
                    if continue_button.is_visible(timeout=3000):
                        print("✓ Найдена кнопка 'Continue', нажимаем")
                        continue_button.click()
                        time.sleep(2)
                except:
                    print("⚠ Кнопка подтверждения не найдена, продолжаем")
        
        # Шаг 5: Ждем редиректа обратно на фронтенд
        print("8. Ожидаем редирект обратно на фронтенд")
        try:
            page.wait_for_url(f"{frontend_url}/**", timeout=20000)
            print(f"✓ Редирект на фронтенд выполнен: {page.url}")
        except Exception as e:
            # Выводим информацию об ошибке
            print(f"⚠ Ошибка редиректа: {e}")
            print(f"⚠ Текущий URL: {page.url}")
            
            # Проверяем, есть ли сообщение об ошибке на странице
            try:
                error_text = page.locator('text=/error|failed|ошибка/i').all_text_contents()
                if error_text:
                    print(f"⚠ Найдены сообщения об ошибках на странице: {error_text}")
            except:
                pass
            
            # Выводим заголовок страницы
            print(f"⚠ Заголовок страницы: {page.title()}")
            
            raise
        
        # Ждем завершения OAuth flow
        # Не используем networkidle, так как фронтенд может делать периодические запросы
        time.sleep(5)
        
        # Шаг 6: Проверяем, что авторизация прошла успешно
        print("9. Проверяем успешную авторизацию")
        print(f"   Текущий URL: {page.url}")
        
        # Ищем элемент, который показывает, что пользователь авторизован
        success_indicator = page.get_by_text("Вы авторизованы")
        expect(success_indicator).to_be_visible(timeout=15000)
        print("✓ Найден индикатор успешной авторизации")
        
        # Проверяем наличие кнопки выхода
        logout_button = page.get_by_role("button", name="Выйти")
        expect(logout_button).to_be_visible()
        print("✓ Найдена кнопка выхода")
        
        # Проверяем, что отображается информация о пользователе
        user_info_section = page.get_by_text("Информация о пользователе")
        expect(user_info_section).to_be_visible()
        print("✓ Отображается информация о пользователе")
        
        print(f"=== Тест авторизации завершен успешно ===\n")


class TestAuthenticatedFeatures:
    """Тесты функций, доступных после авторизации."""
    
    @pytest.fixture(scope="class")
    def authenticated_page(
        self, 
        browser, 
        frontend_url: str, 
        test_user_credentials: dict
    ):
        """
        Фикстура, которая создает авторизованную страницу для всех тестов в классе.
        Это позволяет избежать повторной авторизации для каждого теста.
        """
        # Создаем новый контекст и страницу
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='ru-RU',
            ignore_https_errors=True,
        )
        page = context.new_page()
        page.set_default_timeout(30000)
        
        # Выполняем авторизацию
        print("\n=== Выполняем авторизацию для тестов ===")
        page.goto(frontend_url)
        page.wait_for_load_state("networkidle")
        time.sleep(1)
        
        # Нажимаем кнопку входа
        login_button = page.get_by_role("button", name="Войти через Authentik")
        login_button.click()
        
        # Ждем редиректа на Authentik
        page.wait_for_url("**/localhost:9000/**", timeout=15000)
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        
        # Проверяем наличие кнопки Keycloak
        try:
            keycloak_button = page.locator('a:has-text("Keycloak"), button:has-text("Keycloak")').first
            if keycloak_button.is_visible(timeout=3000):
                keycloak_button.click()
                page.wait_for_load_state("networkidle")
                time.sleep(2)
        except:
            pass
        
        # Вводим учетные данные
        current_url = page.url
        if "keycloak" in current_url.lower() or "8080" in current_url:
            page.wait_for_selector('input[name="username"], input[id="username"]', timeout=10000)
            page.locator('input[name="username"], input[id="username"]').first.fill(test_user_credentials["username"])
            page.locator('input[name="password"], input[id="password"]').first.fill(test_user_credentials["password"])
            page.locator('input[type="submit"], button[type="submit"]').first.click()
        else:
            page.wait_for_selector('input[name="uidField"], input[type="text"]', timeout=10000)
            page.locator('input[name="uidField"], input[type="text"]').first.fill(test_user_credentials["username"])
            try:
                continue_button = page.get_by_role("button", name="Continue")
                if continue_button.is_visible(timeout=2000):
                    continue_button.click()
                    time.sleep(1)
            except:
                pass
            page.locator('input[name="password"], input[type="password"]').first.fill(test_user_credentials["password"])
            page.get_by_role("button", name="Sign in").click()
        
        # Ждем редиректа на фронтенд
        page.wait_for_url(f"{frontend_url}/**", timeout=20000)
        time.sleep(5)
        
        # Проверяем успешную авторизацию
        success_indicator = page.get_by_text("Вы авторизованы")
        expect(success_indicator).to_be_visible(timeout=10000)
        print("✓ Авторизация выполнена успешно\n")
        
        yield page
        
        # Закрываем страницу и контекст после всех тестов
        page.close()
        context.close()
    
    def test_frontend_shows_content_after_redirect(self, authenticated_page: Page):
        """
        Проверяет, что фронтенд показывает содержимое после успешного редиректа.
        """
        print("=== Тест: Проверка отображения контента после редиректа ===")
        
        # Проверяем наличие основных элементов интерфейса
        expect(authenticated_page.get_by_text("Вы авторизованы")).to_be_visible()
        expect(authenticated_page.get_by_text("Информация о пользователе")).to_be_visible()
        expect(authenticated_page.get_by_text("Запрос к бэкенду")).to_be_visible()
        
        print("✓ Все основные элементы интерфейса отображаются")
        print("=== Тест завершен успешно ===\n")
    
    def test_reports_button_shows_jwt_content(self, authenticated_page: Page):
        """
        Проверяет, что кнопка /reports показывает содержимое JWT (данные пользователя).
        """
        print("=== Тест: Проверка кнопки /reports ===")
        
        # Находим и нажимаем кнопку "Вызвать GET /reports"
        reports_button = authenticated_page.get_by_role("button", name="Вызвать GET /reports")
        expect(reports_button).to_be_visible()
        print("✓ Кнопка 'Вызвать GET /reports' найдена")
        
        reports_button.click()
        print("✓ Кнопка нажата")
        
        # Ждем ответа от бэкенда
        time.sleep(2)
        
        # Проверяем наличие статуса ответа
        status_text = authenticated_page.get_by_text("HTTP статус код:")
        expect(status_text).to_be_visible(timeout=10000)
        print("✓ Получен ответ от бэкенда")
        
        # Проверяем, что статус код 200
        status_code = authenticated_page.locator('span.font-mono').first
        expect(status_code).to_have_text("200")
        print("✓ Статус код: 200")
        
        # Проверяем наличие JSON ответа
        json_response = authenticated_page.locator('pre').first
        expect(json_response).to_be_visible()
        
        # Получаем текст ответа и парсим JSON
        response_text = json_response.inner_text()
        response_data = json.loads(response_text)
        
        # Проверяем структуру ответа
        assert "message" in response_data, "Ответ не содержит поле 'message'"
        assert "user" in response_data, "Ответ не содержит поле 'user'"
        assert "reports" in response_data, "Ответ не содержит поле 'reports'"
        
        # Проверяем данные пользователя
        user_data = response_data["user"]
        assert "username" in user_data, "Данные пользователя не содержат 'username'"
        assert "email" in user_data, "Данные пользователя не содержат 'email'"
        assert "groups" in user_data, "Данные пользователя не содержат 'groups'"
        assert "uid" in user_data, "Данные пользователя не содержат 'uid'"
        
        print(f"✓ Получены данные пользователя:")
        print(f"  - Username: {user_data.get('username')}")
        print(f"  - Email: {user_data.get('email')}")
        print(f"  - Groups: {user_data.get('groups')}")
        print(f"  - UID: {user_data.get('uid')}")
        
        # Проверяем наличие отчетов
        reports = response_data["reports"]
        assert len(reports) > 0, "Список отчетов пуст"
        print(f"✓ Получено отчетов: {len(reports)}")
        
        print("=== Тест завершен успешно ===\n")


class TestFullE2EScenario:
    """Полный E2E сценарий от начала до конца."""
    
    def test_complete_user_journey(
        self,
        page: Page,
        frontend_url: str,
        backend_url: str,
        test_user_credentials: dict
    ):
        """
        Полный сценарий использования приложения:
        1. Проверка доступности сервисов
        2. Открытие фронтенда
        3. Авторизация
        4. Проверка отображения контента
        5. Вызов API бэкенда
        6. Проверка данных
        """
        print("\n" + "="*70)
        print("=== ПОЛНЫЙ E2E СЦЕНАРИЙ ===")
        print("="*70)
        
        # 1. Проверка доступности бэкенда
        print("\n1. Проверяем доступность бэкенда")
        response = requests.get(backend_url + "/", timeout=10)
        assert response.status_code == 404
        assert response.json().get("detail") == "Not Found"
        print(f"✓ Backend доступен: {backend_url}")
        
        # 2. Открываем фронтенд
        print("\n2. Открываем фронтенд")
        page.goto(frontend_url)
        page.wait_for_load_state("networkidle")
        time.sleep(1)
        print(f"✓ Фронтенд загружен: {frontend_url}")
        
        # 3. Авторизация
        print("\n3. Выполняем авторизацию")
        login_button = page.get_by_role("button", name="Войти через Authentik")
        expect(login_button).to_be_visible(timeout=10000)
        login_button.click()
        
        page.wait_for_url("**/localhost:9000/**", timeout=15000)
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        
        # Проверяем кнопку Keycloak
        try:
            keycloak_button = page.locator('a:has-text("Keycloak"), button:has-text("Keycloak")').first
            if keycloak_button.is_visible(timeout=3000):
                keycloak_button.click()
                page.wait_for_load_state("networkidle")
                time.sleep(2)
        except:
            pass
        
        # Вводим учетные данные
        current_url = page.url
        if "keycloak" in current_url.lower() or "8080" in current_url:
            page.wait_for_selector('input[name="username"], input[id="username"]', timeout=10000)
            page.locator('input[name="username"], input[id="username"]').first.fill(test_user_credentials["username"])
            page.locator('input[name="password"], input[id="password"]').first.fill(test_user_credentials["password"])
            page.locator('input[type="submit"], button[type="submit"]').first.click()
        else:
            page.wait_for_selector('input[name="uidField"], input[type="text"]', timeout=10000)
            page.locator('input[name="uidField"], input[type="text"]').first.fill(test_user_credentials["username"])
            try:
                continue_button = page.get_by_role("button", name="Continue")
                if continue_button.is_visible(timeout=2000):
                    continue_button.click()
                    time.sleep(1)
            except:
                pass
            page.locator('input[name="password"], input[type="password"]').first.fill(test_user_credentials["password"])
            page.get_by_role("button", name="Sign in").click()
        
        page.wait_for_url(f"{frontend_url}/**", timeout=20000)
        time.sleep(5)
        print("✓ Авторизация выполнена успешно")
        
        # 4. Проверяем отображение контента
        print("\n4. Проверяем отображение контента после авторизации")
        expect(page.get_by_text("Вы авторизованы")).to_be_visible(timeout=10000)
        expect(page.get_by_text("Информация о пользователе")).to_be_visible()
        expect(page.get_by_text("Запрос к бэкенду")).to_be_visible()
        
        # 5. Вызываем API бэкенда
        print("\n5. Вызываем API бэкенда через кнопку /reports")
        reports_button = page.get_by_role("button", name="Вызвать GET /reports")
        expect(reports_button).to_be_visible()
        reports_button.click()
        time.sleep(2)
        
        # 6. Проверяем данные
        print("\n6. Проверяем полученные данные")
        status_code = page.locator('span.font-mono').first
        expect(status_code).to_have_text("200")
        
        json_response = page.locator('pre').first
        expect(json_response).to_be_visible()
        response_text = json_response.inner_text()
        response_data = json.loads(response_text)
        
        assert "user" in response_data
        assert response_data["user"]["username"] == test_user_credentials["username"]
        print(f"✓ Получены корректные данные пользователя: {response_data['user']['username']}")
        
        print("\n" + "="*70)
        print("=== ПОЛНЫЙ E2E СЦЕНАРИЙ ЗАВЕРШЕН УСПЕШНО ===")
        print("="*70 + "\n")
