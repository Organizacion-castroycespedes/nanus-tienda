# Evidencia QA operativo integral MVP-01.1

Fecha: 2026-06-10 America/Bogota

Cambio OpenSpec: `mvp-web-hardening`

Resultado: `QA_OPERATIVO_AUTH_RBAC_TERMINALES_BLOCKED_LOCAL_HEALTH`

Motivo: login, sesiones, roles, menus, permisos y terminales POS pasaron por API publica QA. PM2 y los health locales `127.0.0.1:4022/4023` no se pudieron revalidar porque SSH a `ubuntu@api.apptiendamanus.space` fallo con `Permission denied (publickey)`.

## Objetivo

Ejecutar QA operativo inicial sobre AWS QA usando `manus_tienda_qa`, cubriendo autenticacion, sesiones activas, RBAC, menus, terminales POS, health/version y perifericos MOCK sin exponer secretos.

## Alcance ejecutado

- Login por rol: `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`, `USER`.
- Sesiones activas: deteccion `SESSION_ACTIVE` y recuperacion por flujo API `POST /api/auth/login/force` cuando fue necesario.
- Menus visibles por rol via `GET /api/me/menu`.
- Permisos base por rol via `GET /api/me/permissions`.
- Terminal POS via `GET /api/pos-terminals/resolve-current`, `GET /api/pos-terminals` y `GET /api/pos-terminals/:id/peripherals`.
- Health/version publicos: `GET /api/system/version`, `GET /api/reports/health`.
- Web QA publica: `https://www.apptiendamanus.space` y `/login`.

## Alcance bloqueado

- PM2 health actual.
- `GET http://127.0.0.1:4022/health`.
- `GET http://127.0.0.1:4023/health`.
- Confirmacion directa `backend-perifericos` health `mode=MOCK`.

Estos checks son local-only en la instancia QA. Requieren SSH valido o salida sanitaria desde el host.

## Ambiente

| Item | Valor |
| --- | --- |
| API QA | `https://api.apptiendamanus.space/api` |
| Web QA | `https://www.apptiendamanus.space` |
| DB esperada | `manus_tienda_qa` |
| Servicios esperados | `api-linux:4020`, `backend-reporteria-linux:4021`, `backend-facturacion-electronica-linux:4022`, `backend-perifericos-linux:4023` |
| Fecha UTC observada en health reporteria | `2026-06-11T01:19:57.457Z` |

No se imprimieron tokens, refresh tokens, passwords ni `.env`.

## Plan QA por rol

| Rol | Alcance esperado | Validacion |
| --- | --- | --- |
| `SUPER_ADMIN` | Global, administra tenants/configuracion y terminales | Login, menu, permisos, `/tenants`, terminales y perifericos |
| `SUPER_USER` | Tenant, administracion operativa amplia | Login, menu, permisos, `/tenants`, terminales y perifericos |
| `ADMIN` | Sucursal, administracion operativa | Login, menu, permisos, bloqueo de `/tenants`, terminales y perifericos |
| `USER` | Operativo, sin administracion de terminales | Login, menu operativo, bloqueo de `/tenants` y `GET /pos-terminals`, resolve current permitido |

## Health y version

| Endpoint | Resultado |
| --- | --- |
| `GET https://api.apptiendamanus.space/api/system/version` | PASS: HTTP 200, `{"version":"0.0.1"}` |
| `GET https://api.apptiendamanus.space/api/reports/health` | PASS: HTTP 200, `status=ok`, `service=backend-reporteria` |
| `GET http://127.0.0.1:4022/health` | BLOCKED: requiere SSH; SSH fallo por public key |
| `GET http://127.0.0.1:4023/health` | BLOCKED: requiere SSH; SSH fallo por public key |
| `GET https://api.apptiendamanus.space/health` | INFO: HTTP 404 controlado; no es el endpoint real actual |
| `GET https://api.apptiendamanus.space/api/health` | INFO: HTTP 404 controlado; no es el endpoint real actual |
| `GET http://api.apptiendamanus.space:4022/health` | BLOCKED/TIMEOUT: puerto no expuesto publicamente |
| `GET http://api.apptiendamanus.space:4023/health` | BLOCKED/TIMEOUT: puerto no expuesto publicamente |

## Web QA

| URL | Resultado |
| --- | --- |
| `https://www.apptiendamanus.space` | PASS: HTTP 200 |
| `https://www.apptiendamanus.space/login` | PASS: HTTP 200 |

## Login, sesiones, menus y permisos

| Rol | Login | Profile role | Tenant | Sucursal | Menu count | Top-level menu |
| --- | --- | --- | --- | --- | ---: | --- |
| `SUPER_ADMIN` | PASS | `SUPER_ADMIN` | `default` | `Sucursal Principal` | 21 | `CONFIGURACION_TENANT_CONFIGURACION`, `CRM_CUSTOMERS`, `CUSTOMERS`, `DASHBOARD_TENANT_DASHBOARD`, `FINANCE`, `INVENTORY`, `ORDERS`, `POS`, `REPORTS` |
| `SUPER_USER` | PASS | `SUPER_USER` | `default` | `Sucursal Principal` | 19 | `CONFIGURACION_TENANT_CONFIGURACION`, `CRM_CUSTOMERS`, `CUSTOMERS`, `DASHBOARD_TENANT_DASHBOARD`, `FINANCE`, `INVENTORY`, `ORDERS`, `POS`, `REPORTS` |
| `ADMIN` | PASS | `ADMIN` | `default` | `Sucursal Principal` | 18 | `CONFIGURACION_TENANT_CONFIGURACION`, `CRM_CUSTOMERS`, `CUSTOMERS`, `DASHBOARD_TENANT_DASHBOARD`, `FINANCE`, `INVENTORY`, `ORDERS`, `POS`, `REPORTS` |
| `USER` | PASS | `USER` | `default` | `Sucursal Principal` | 14 | `CRM_CUSTOMERS`, `CUSTOMERS`, `DASHBOARD_TENANT_DASHBOARD`, `FINANCE`, `INVENTORY`, `ORDERS`, `POS`, `REPORTS` |

Nota de sesiones: para roles demo operativos, `POST /api/auth/login` devolvio `SESSION_ACTIVE`; se uso `POST /api/auth/login/force` para completar el smoke autenticado. Esto valida que el control de sesion activa responde y que el flujo forzado genera sesion nueva. Para `SUPER_ADMIN`, el login fue validado y en corridas posteriores tambien se observo `SESSION_ACTIVE`.

## Permisos base por rol

| Rol | `POS_PERIPHERALS` | Acciones | `/tenants` | `GET /pos-terminals` | `GET /pos-terminals/resolve-current` |
| --- | --- | --- | --- | --- | --- |
| `SUPER_ADMIN` | `WRITE` | `read=true`, `manage=true` | PASS | PASS | PASS: `CONFIGURED` |
| `SUPER_USER` | `WRITE` | `read=true`, `manage=true` | PASS | PASS | PASS: `CONFIGURED` |
| `ADMIN` | `WRITE` | `read=true`, `manage=true` | PASS: HTTP 403 esperado para global | PASS | PASS: `CONFIGURED` |
| `USER` | `NONE` | `{}` | PASS: HTTP 403 esperado | PASS: HTTP 403 esperado | PASS: `CONFIGURED` |

Interpretacion:

- `SUPER_ADMIN`: permiso global operativo validado por `/tenants` y terminales.
- `SUPER_USER`: permiso amplio de tenant validado por menu/configuracion y terminales.
- `ADMIN`: queda restringido frente a `/tenants`, pero administra terminales de su contexto.
- `USER`: ve POS operativo y resuelve terminal actual, pero no administra terminales ni perifericos.

## Terminal POS

Smoke ejecutado con rol `ADMIN`.

| Check | Resultado |
| --- | --- |
| `GET /api/pos-terminals/resolve-current` | PASS: `source=CONFIGURED`, `mode=MOCK` |
| `GET /api/pos-terminals` | PASS: `terminalCount=1` |
| Terminal | `code=local-terminal`, `name=Terminal MOCK local` |
| `GET /api/pos-terminals/:id/peripherals` | PASS |
| Printer | `mock-printer-001` |
| Cash drawer | `mock-cashdrawer-001` |
| Scale | `mock-scale-001` |
| Scanner | `mock-scanner-001` |

## Perifericos MOCK

| Check | Resultado |
| --- | --- |
| API terminal/peripherals usa device IDs MOCK | PASS |
| `resolve-current` devuelve `mode=MOCK` | PASS |
| `backend-perifericos` health directo `mode=MOCK` | BLOCKED: requiere SSH a `127.0.0.1:4023` |
| Puertos publicos `4022/4023` | TIMEOUT esperado; no expuestos publicamente |

## PM2 health

No revalidado en esta corrida.

Intentos SSH:

```text
ssh -o BatchMode=yes ubuntu@api.apptiendamanus.space hostname
Host key verification failed.

ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL -o BatchMode=yes ubuntu@api.apptiendamanus.space hostname
ubuntu@api.apptiendamanus.space: Permission denied (publickey).
```

Se creo accidentalmente un archivo local `NUL` por `UserKnownHostsFile=NUL` en Windows; fue eliminado y `git status --short` volvio limpio antes de editar evidencia.

## Restricciones cumplidas

- No se modifico codigo.
- No se ejecutaron migraciones.
- No se hizo deploy.
- No se reinicio PM2.
- No se tocaron `.env` reales.
- No se imprimieron tokens ni refresh tokens.
- No se imprimieron passwords.
- No se hicieron escrituras manuales en DB.
- No se conecto hardware real.
- No se activo `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.

## Hallazgos

1. `GET /api/system/version` y `GET /api/reports/health` estan operativos por HTTPS publico.
2. Login y menu por rol pasan.
3. `SESSION_ACTIVE` aparece en usuarios demo; el comportamiento es esperado por la politica de una sesion activa.
4. `USER` queda correctamente bloqueado para administracion de terminales.
5. Terminal POS esta configurada en `MOCK` con devices mock.
6. Health local de FE/perifericos y PM2 no se pueden declarar PASS sin SSH valido.

## Decision

No se emite `QA_OPERATIVO_AUTH_RBAC_TERMINALES_READY` en esta corrida porque faltan PM2 y health local `4022/4023`.

Estado emitido:

```text
QA_OPERATIVO_AUTH_RBAC_TERMINALES_BLOCKED_LOCAL_HEALTH
```

Para desbloquear:

1. Proveer SSH valido para `ubuntu@api.apptiendamanus.space` o salida sanitaria de los comandos local-only.
2. Ejecutar:

```text
pm2 list
curl -fsS http://127.0.0.1:4022/health
curl -fsS http://127.0.0.1:4023/health
```

3. Confirmar que `backend-perifericos` responde `mode=MOCK`.
