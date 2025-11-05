"""Основной модуль API для отчетов с проверкой JWT-токенов от Authentik."""

# Импортируем модуль json для сериализации словарей в строки
import json
# Импортируем модуль logging для вывода диагностических сообщений
import logging
# Импортируем типы Any и Dict для аннотаций типов функций
from typing import Any, Dict, Optional

# Импортируем httpx для выполнения HTTP-запросов к Authentik/Keycloak
import httpx
# Импортируем Depends, FastAPI, Header и HTTPException для построения API
from fastapi import Depends, FastAPI, Header, HTTPException, Request
# Импортируем CORSMiddleware для настройки CORS-политики
from fastapi.middleware.cors import CORSMiddleware
# Импортируем библиотеку PyJWT для работы с JWT-токенами
import jwt
# Импортируем RSAAlgorithm для преобразования открытых ключей из JWK в формат RSA
from jwt.algorithms import RSAAlgorithm
# Импортируем набор исключений PyJWT для обработки ошибок проверки токена
from jwt import exceptions as jwt_exceptions

# Настраиваем базовый уровень логирования на INFO
logging.basicConfig(level=logging.INFO)

# Создаем экземпляр FastAPI для определения маршрутов сервиса
app = FastAPI()

# Добавляем промежуточное ПО для поддержки CORS-запросов с фронтенда
app.add_middleware(
    # Указываем класс промежуточного ПО, который добавляем
    CORSMiddleware,
    # Определяем список доменов, которым разрешен доступ к API
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:9000",  # Authentik
        "*"
    ],
    # Разрешаем передачу cookies и авторизационных заголовков
    allow_credentials=True,
    # Разрешаем все HTTP-методы для запросов
    allow_methods=["*"],
    # Разрешаем любые заголовки в запросах
    allow_headers=["*"],
    # Разрешаем фронтенду видеть заголовки, которые инжектирует Authentik
    expose_headers=["X-Authentik-Username", "X-Authentik-Groups", "X-Authentik-Email", "X-Authentik-Uid"],
)


# Определяем класс конфигурации для параметров Authentik/Keycloak
class KeycloakConfig:
    # Указываем адрес издателя токенов - теперь это Authentik
    issuer: str = "http://localhost:9000/application/o/bionicpro-frontend/"
    # Формируем URL для получения открытых ключей (JWKS) Authentik
    jwks_url: str = "http://localhost:9000/application/o/bionicpro-frontend/jwks/"
    # Указываем ожидаемую аудиторию (client_id) токена для backend-а
    # Для Authentik это client_id фронтенда
    audience: str | None = "bionicpro-frontend"
    # Указываем допустимые алгоритмы подписи токена
    algorithms: tuple[str, ...] = ("RS256",)


# Определяем асинхронную функцию для получения JWKS с сервера Keycloak
async def get_jwks() -> Dict[str, Any]:
    # Создаем асинхронный HTTP-клиент с таймаутом в 5 секунд
    async with httpx.AsyncClient(timeout=5) as client:
        # Выполняем GET-запрос на получение набора ключей
        response = await client.get(KeycloakConfig.jwks_url)
        # Бросаем исключение, если Keycloak вернул ошибку
        response.raise_for_status()
        # Возвращаем тело ответа в виде словаря
        return response.json()


# Определяем зависимость FastAPI для извлечения данных пользователя из заголовков Authentik
async def get_user_from_headers(
    request: Request,
    x_authentik_username: Optional[str] = Header(default=None, alias="X-Authentik-Username"),
    x_authentik_email: Optional[str] = Header(default=None, alias="X-Authentik-Email"),
    x_authentik_groups: Optional[str] = Header(default=None, alias="X-Authentik-Groups"),
    x_authentik_uid: Optional[str] = Header(default=None, alias="X-Authentik-Uid"),
) -> Dict[str, Any]:
    """
    Извлекает информацию о пользователе из заголовков, которые инжектирует Authentik.
    Authentik работает как прокси и добавляет эти заголовки после успешной аутентификации.
    """
    # Проверяем наличие обязательных заголовков от Authentik
    if not x_authentik_username:
        logging.warning("Missing X-Authentik-Username header")
        raise HTTPException(
            status_code=401, 
            detail="Missing authentication headers from Authentik"
        )
    
    # Парсим группы (роли) из заголовка
    groups = []
    if x_authentik_groups:
        # Authentik передает группы через запятую или другой разделитель
        groups = [g.strip() for g in x_authentik_groups.split(",") if g.strip()]
    
    # Формируем словарь с данными пользователя
    user_info = {
        "username": x_authentik_username,
        "email": x_authentik_email,
        "groups": groups,
        "uid": x_authentik_uid,
        "authenticated_via": "authentik"
    }
    
    logging.info("User authenticated via Authentik: %s", json.dumps(user_info))
    return user_info


# Определяем зависимость FastAPI для проверки JWT-токена в заголовке Authorization
# Эта функция оставлена для обратной совместимости, если нужно проверять JWT напрямую
async def verify_jwt(
    authorization: str = Header(default=None),
    jwks: Dict[str, Any] = Depends(get_jwks),
) -> Dict[str, Any]:
    # Проверяем, что заголовок Authorization присутствует и содержит схему Bearer
    if not authorization or not authorization.lower().startswith("bearer "):
        # Возвращаем ошибку 401, если токен отсутствует
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    # Извлекаем сам токен из заголовка Authorization
    token = authorization.split(" ", 1)[1]
    # Пытаемся получить заголовок токена без проверки подписи
    try:
        header = jwt.get_unverified_header(token)
    # Обрабатываем любые ошибки парсинга заголовка токена
    except jwt_exceptions.PyJWTError as exc:
        # Возвращаем ошибку 401, если заголовок токена некорректен
        raise HTTPException(status_code=401, detail="Invalid token header") from exc

    logging.info("Token header kid: %s", header.get("kid"))

    # Ищем подходящий ключ в JWKS по идентификатору ключа (kid)
    key_dict = next((k for k in jwks.get("keys", []) if k.get("kid") == header.get("kid")), None)
    # Проверяем, что ключ найден
    if not key_dict:
        # Возвращаем ошибку 401, если публичный ключ не найден
        logging.error("Public key not found for kid: %s", header.get("kid"))
        raise HTTPException(status_code=401, detail="Token signature key not found")

    logging.info("Key found for kid: %s", header.get("kid"))

    # Преобразуем найденный JWK в объект RSA-ключа
    public_key = RSAAlgorithm.from_jwk(json.dumps(key_dict))

    # Пытаемся декодировать и проверить токен с использованием публичного ключа
    try:
        logging.info("Decoding token with audience=None and issuer=%s", KeycloakConfig.issuer)
        # Получаем payload без проверки для диагностики
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        logging.info("Token payload audience: %s", unverified_payload.get("aud"))
        logging.info("Token payload issuer: %s", unverified_payload.get("iss"))

        payload = jwt.decode(
            token,
            public_key,
            algorithms=list(KeycloakConfig.algorithms),
            audience=KeycloakConfig.audience,  # Use configured audience
            issuer=KeycloakConfig.issuer,
        )
        logging.info("Token decoded successfully")
    # Обрабатываем ошибку истечения срока действия токена
    except jwt_exceptions.ExpiredSignatureError as exc:
        # Возвращаем ошибку 401 при просроченном токене
        logging.error("Token expired: %s", exc)
        raise HTTPException(status_code=401, detail="Token expired") from exc
    # Обрабатываем ошибки, связанные с аудиториями или издателем токена
    except (jwt_exceptions.InvalidAudienceError, jwt_exceptions.InvalidIssuerError) as exc:
        # Возвращаем ошибку 401 при неверных параметрах токена
        logging.error("Invalid token claims: %s", exc)
        logging.error("Token issuer from token: %s", jwt.decode(token, options={"verify_signature": False}).get("iss"))
        logging.error("Expected issuer: %s", KeycloakConfig.issuer)
        raise HTTPException(status_code=401, detail="Invalid token claims") from exc
    # Обрабатываем любые другие ошибки валидации токена
    except jwt_exceptions.PyJWTError as exc:
        # Возвращаем ошибку 401, если токен некорректен по другим причинам
        logging.error("Invalid token: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    # Возвращаем полезную нагрузку токена, если проверка успешно прошла
    return payload


# Описываем маршрут GET /reports, который требует аутентификацию через Authentik
@app.get("/reports")
async def get_reports(user_info: Dict[str, Any] = Depends(get_user_from_headers)) -> Dict[str, Any]:
    # Логируем информацию о пользователе из заголовков Authentik
    logging.info("User info from Authentik: %s", json.dumps(user_info))
    # Возвращаем информацию о пользователе в ответе API
    return {
        "message": "Reports endpoint accessed successfully",
        "user": user_info,
        "reports": [
            {"id": 1, "name": "Monthly Report", "status": "completed"},
            {"id": 2, "name": "Quarterly Report", "status": "in_progress"},
        ]
    }


# Альтернативный маршрут для проверки JWT напрямую (для отладки)
@app.get("/reports-jwt")
async def get_reports_jwt(payload: Dict[str, Any] = Depends(verify_jwt)) -> Dict[str, Any]:
    # Логируем полезную нагрузку токена в формате JSON
    logging.info("JWT payload: %s", json.dumps(payload))
    
    # Формируем информацию о пользователе из JWT payload
    user_info = {
        "username": payload.get("preferred_username") or payload.get("sub"),
        "email": payload.get("email"),
        "groups": payload.get("groups", []),
        "roles": payload.get("roles", []),
        "resource_access": payload.get("resource_access", {}),
        "given_name": payload.get("given_name"),
        "family_name": payload.get("family_name"),
        "uid": payload.get("sub"),
        "authenticated_via": "JWT Token (Authentik)",
    }
    
    # Возвращаем ту же структуру, что и /reports
    return {
        "message": "Successfully authenticated via JWT",
        "user": user_info,
        "reports": [
            {"id": 1, "name": "Report 1", "status": "completed"},
            {"id": 2, "name": "Report 2", "status": "in_progress"},
            {"id": 3, "name": "Report 3", "status": "pending"},
        ],
    }


# Запускаем приложение, если файл выполняется напрямую
if __name__ == "__main__":
    # Импортируем asyncio и uvicorn для запуска сервера
    import asyncio
    from uvicorn import Config, Server

    # Создаем конфигурацию сервера
    config = Config(app, host="0.0.0.0", port=3001)
    # Создаем экземпляр сервера
    server = Server(config)
    # Запускаем сервер с asyncio.run
    asyncio.run(server.serve())