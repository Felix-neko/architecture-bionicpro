go install github.com/oauth2-proxy/oauth2-proxy/v7@latest

# cookie-secure=false выставляем только для отладочных целей
# cookie-refresh: обновление cookie за 1 минуту до истечения access token (300s - 60s = 240s = 4m)
# cookie-samesite=lax: защита от CSRF атак, разрешает отправку cookie при переходе с внешних сайтов
# session-store-type=redis: используем Redis для хранения сессий (масштабируемость, персистентность)
# redis-connection-url: подключение к Redis на localhost:6379

# Настройка: проксируем на фронтенд, который через vite proxy обращается к бэкенду
$HOME/go/bin/oauth2-proxy \
  --provider=oidc \
  --oidc-issuer-url=http://localhost:8080/realms/reports-realm \
  --http-address=0.0.0.0:4180 \
  --cookie-secret=85SXV2I6e5dOkTlCcmu5S2M2CBO3_Kqi71slB8jJl4s= \
  --cookie-refresh=10s \
  --cookie-csrf-expire=30s \
  --cookie-csrf-per-request=true \
  --cookie-expire=1h \
  --cookie-samesite=lax \
  --session-store-type=redis \
  --redis-connection-url=redis://localhost:6379 \
  --client-id=oauth2-proxy \
  --client-secret=oauth2-proxy-secret-key-change-in-production \
  --code-challenge-method=S256 \
  --email-domain=* \
  --redirect-url=http://localhost:4180/oauth2/callback \
  --cookie-secure=false \
  --insecure-oidc-allow-unverified-email  \
  --standard-logging \
  --auth-logging \
  --request-logging \
  --prompt=login \
#  --pass-access-token=true \
#  --pass-authorization-header=true \
#  --set-authorization-header=true \
  --skip-provider-button=false \
  --scope="openid profile email roles" \
  --upstream=http://localhost:5173
