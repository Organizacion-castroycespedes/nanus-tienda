# Evidencia QA operativo integral MVP-01.2

Fecha rerun: 2026-06-11 America/Bogota.

Cambio OpenSpec: `mvp-web-hardening`

Resultado: `QA_OPERATIVO_CLIENTES_PROVEEDORES_PRODUCTOS_BLOCKED_AUTH_500`

Motivo: despues de bootstrap exitoso reportado para `manus_tienda_qa`, la API publica responde health/version, pero el login QA devuelve HTTP 500. Sin token valido no se pueden re-ejecutar endpoints protegidos de Clientes FE, Proveedores FE, Productos, Units, Taxes, Promociones ni Inventario loteado.

## Contexto declarado

- `manus_tienda_qa` fue recreada.
- Bootstrap termino correctamente.
- `V058__qa_required_catalog_seed.sql`: aplicado.
- `20260611_mvp_01_2b_functional_qa_fixtures.sql`: aplicado.
- `011_prd_default_customer.sql`: aplicado.
- Functional QA fixtures: aplicados.
- Reporting fixtures: omitidos.

## Ambiente

| Item | Valor |
| --- | --- |
| API QA | `https://api.apptiendamanus.space/api` |
| DB esperada | `manus_tienda_qa` |
| Rama/release esperado | `release/evolutivo/0.0.1` |
| Actor QA intentado | `SUPER_ADMIN` y usuarios demo versionados |

No se imprimieron tokens, refresh tokens, passwords ni `.env`.

## Health publico

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/system/version` | PASS | HTTP 200, `version=0.0.1`. |
| `GET /api/reports/health` | PASS | HTTP 200, `status=ok`, `service=backend-reporteria`. |

## Auth

| Check | Estado | Resultado |
| --- | --- | --- |
| `POST /api/auth/login` con credenciales QA locales no impresas | FAIL | HTTP 500, `Internal server error`. |
| `POST /api/auth/login/force` con credenciales QA locales no impresas | FAIL | HTTP 500, `Internal server error`. |
| `POST /api/auth/login/force` con `super.user+default@manustienda.local` | FAIL | HTTP 500, `Internal server error`. |
| `POST /api/auth/login/force` con `admin+default@manustienda.local` | FAIL | HTTP 500, `Internal server error`. |
| `POST /api/auth/login/force` con `user+default@manustienda.local` | FAIL | HTTP 500, `Internal server error`. |

Notas:

- Los usuarios demo y la clave demo usada vienen de `scripts/database/009_seed_demo_operational_users.sql`.
- El token no se pudo obtener.
- No se intento leer logs PM2 ni tocar servidor por restriccion de no PM2/no deploy/no AWS.

## QA funcional protegido

| Bloque | Estado | Evidencia |
| --- | --- | --- |
| Clientes FE | BLOCKED | Requiere token. No se pudo validar `GET /api/electronic-invoicing/customers/default`. |
| Consumidor final ensure | BLOCKED | Requiere token. No se pudo validar `POST /api/electronic-invoicing/customers/default/ensure`. |
| Proveedores FE | BLOCKED | Requiere token. |
| Productos | BLOCKED | Requiere token. No se pudo validar `QA-BASE-LOT-001`. |
| Units | BLOCKED | Requiere token. No se pudo validar `units > 0`. |
| Taxes | BLOCKED | Requiere token. No se pudo validar `taxes > 0`. |
| Promociones | BLOCKED | Requiere token. |
| Inventario loteado | BLOCKED | Requiere token. No se pudo validar `QA-LOT-MVP-01-2B-001`. |

## Checks esperados no ejecutables por bloqueo auth

- `GET /api/electronic-invoicing/customers/default` debe devolver HTTP 200.
- `POST /api/electronic-invoicing/customers/default/ensure` debe ser idempotente.
- `GET /api/units` debe devolver unidades activas base.
- `GET /api/taxes` debe devolver impuestos activos base.
- `GET /api/products?branchId=...` debe incluir `QA-BASE-LOT-001`.
- `GET /api/inventory/lot-balances?...` debe incluir `QA-LOT-MVP-01-2B-001`.

## Restricciones cumplidas

- No se modifico codigo.
- No se ejecutaron migraciones.
- No se hizo deploy.
- No se reinicio PM2.
- No se hicieron escrituras directas en DB.
- Solo se hicieron requests QA HTTP y evidencia.
- No se expusieron secretos.

## Diagnostico

El bloqueo actual no es V058 ni fixture funcional. El bootstrap puede haber terminado, pero API runtime no permite autenticar contra el estado actual de `manus_tienda_qa`.

Para continuar el rerun funcional se requiere una de estas evidencias:

- credenciales QA validas para `manus_tienda_qa`;
- o logs sanitizados de API alrededor de `POST /api/auth/login/force`;
- o confirmacion de que el backend API esta apuntando a `manus_tienda_qa` y que `auth_sessions`, `auth_refresh_tokens`, `users`, `roles`, `user_roles`, `personas` y `persona_tenant_branches` quedaron consistentes.

## Decision

No se emite `QA_OPERATIVO_CLIENTES_PROVEEDORES_PRODUCTOS_READY`.

Estado emitido:

```text
QA_OPERATIVO_CLIENTES_PROVEEDORES_PRODUCTOS_BLOCKED_AUTH_500
```
