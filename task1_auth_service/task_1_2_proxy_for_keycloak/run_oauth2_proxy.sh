go install github.com/oauth2-proxy/oauth2-proxy/v7@latest

# Настройка: проксируем на фронтенд, который через vite proxy обращается к бэкенду
$HOME/go/bin/oauth2-proxy \
  --provider=oidc \
  --oidc-issuer-url=http://localhost:8080/realms/reports-realm \
  --http-address=0.0.0.0:4180 \
  --cookie-secret=85SXV2I6e5dOkTlCcmu5S2M2CBO3_Kqi71slB8jJl4s= \
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
  --pass-access-token=true \
  --pass-authorization-header=true \
  --set-authorization-header=true \
  --skip-provider-button=false \
  --scope="openid profile email roles" \
  --upstream=http://localhost:5173
