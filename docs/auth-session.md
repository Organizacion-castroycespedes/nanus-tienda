# Auth session hardening (SMG)

## Objetivo

- Eliminar tokens en `localStorage`.
- Mantener `access_token` sólo en memoria (Redux Toolkit).
- Permitir `refresh_token` en cookie HttpOnly cuando backend lo soporte.
- Evitar re-login en el mismo perfil del navegador.
- Refresh automático + rehidratación de usuario, permisos y menú.

## Decisiones de seguridad y trade-offs

- `access_token` se conserva en memoria (Redux). Se limpia en logout/falla de refresh.
- `refresh_token` **preferido** en cookie HttpOnly (SameSite=Lax/Strict + Secure). Esto evita exposición a XSS.
- Si backend aún no soporta cookie HttpOnly, se permite `sessionStorage` **opt-in** vía `NEXT_PUBLIC_REFRESH_TOKEN_STORAGE=session`.
  - En este modo, el refresh token vive sólo por sesión del navegador y se minimiza el tiempo de exposición.
  - Se recomienda CSP estricta y sanitización exhaustiva para reducir riesgo XSS.
- El caché de menú se mueve a Redux y, si se desea performance, se guarda en `sessionStorage` cifrado con el access token.

## Configuración backend recomendada (cookie HttpOnly)

- Endpoint `POST /auth/refresh` debe:
  - Leer cookie HttpOnly `smg_refresh` (o el nombre acordado).
  - Validarla y emitir un nuevo access token.
  - Rotar refresh token (opcional pero recomendado) y reescribir cookie.
- Configuración de cookie:
  - `HttpOnly: true`
  - `Secure: true` (HTTPS)
  - `SameSite: Lax` (o `Strict` según UX)
  - `Path: /auth/refresh`

## Validación de expiración + refresh

- El `exp` del JWT se usa para calcular `tokenExpiry` en Redux.
- Un scheduler programa el refresh ~60s antes de expirar.
- El cliente intercepta 401, ejecuta refresh único (mutex) y reintenta la request.

## Comportamiento multi-tab

- El bloqueo de re-login aplica dentro de la misma app/perfil gracias al estado en Redux.
- Sin `localStorage`, cada tab mantiene su propia sesión en memoria.
- Con cookie HttpOnly, un refresh en cualquier tab mantiene sesión, pero el estado se rehidrata sólo en la tab actual.

