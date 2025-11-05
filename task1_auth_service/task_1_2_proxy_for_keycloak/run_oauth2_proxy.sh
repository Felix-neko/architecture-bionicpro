export OAUTH2_PROXY_UPSTREAMS=http://localhost:3001

$HOME/go/bin/oauth2-proxy \
  --provider=oidc \
  --oidc-issuer-url=http://localhost:8080/realms/reports-realm \
  --http-address=0.0.0.0:4180 \
  --cookie-secret=85SXV2I6e5dOkTlCcmu5S2M2CBO3_Kqi71slB8jJl4s= \
  --client-id=oauth2-proxy-demo \
  --client-secret=88e6OJjIUkuKXc72IJR7LF3Tp1jeGB8L \
  --code-challenge-method=S256 \
  --email-domain=* \
  --redirect-url=http://localhost:4180/oauth2/callback \
  --cookie-secure=false \
  --insecure-oidc-allow-unverified-email  \
  --standard-logging \
  --auth-logging \
  --request-logging