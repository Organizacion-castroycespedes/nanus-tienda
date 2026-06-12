# Evidencia QA operativo integral MVP-01.2

Fecha rerun: 2026-06-11 America/Bogota.

Cambio OpenSpec: `mvp-web-hardening`

Resultado: `QA_OPERATIVO_CLIENTES_PROVEEDORES_PRODUCTOS_READY`

## Contexto

El bloqueo previo `AUTH_500` fue resuelto.

Confirmaciones recibidas:

- `manus_user` ya puede consultar `users` en `manus_tienda_qa`.
- API QA fue reiniciada.
- Bootstrap QA termino correctamente.
- Grants runtime quedaron aplicados al usuario correcto.

## Ambiente

| Item | Valor |
| --- | --- |
| API QA | `https://api.apptiendamanus.space/api` |
| DB esperada | `manus_tienda_qa` |
| Tenant | `default` |
| Actor QA | `SUPER_ADMIN` seed desde env local ignorado |

No se imprimieron tokens, refresh tokens, passwords ni contenido de `.env`.

## Health y auth

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/system/version` | PASS | HTTP 200, `version=0.0.1`. |
| `GET /api/reports/health` | PASS | HTTP 200, `status=ok`, `service=backend-reporteria`. |
| `POST /api/auth/login/force` | PASS | HTTP 201, token recibido y no impreso. |
| `GET /api/auth/me` | PASS | HTTP 200, rol `SUPER_ADMIN`, tenant `default`. |
| `GET /api/auth/context` | PASS | HTTP 200, branch resuelta. |
| `GET /api/auth/menu` | PASS | HTTP 200. |

Nota: los usuarios demo `ADMIN`, `SUPER_USER` y `USER` autentican, pero no tienen permisos FE para `ELECTRONIC_INVOICING_CUSTOMERS` ni `ELECTRONIC_INVOICING_SUPPLIERS`. Para validar FE se uso `SUPER_ADMIN`, que bypassa `PermissionsGuard` como define el codigo.

## Clientes FE

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/electronic-invoicing/customers/default` | PASS | HTTP 200, `isFinalConsumer=true`. |
| `POST /api/electronic-invoicing/customers/default/ensure` | PASS | HTTP 201, idempotente. |
| `GET /api/electronic-invoicing/customers?search=QA Cliente FE Base` | PASS | HTTP 200, fixture encontrado. |
| `GET /api/electronic-invoicing/customers/:id` | PASS | HTTP 200. |
| `POST /api/electronic-invoicing/customers/lookup` | WARN | HTTP 201, `provider=NONE`, `lookupStatus=SKIPPED`. |

## Proveedores FE

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/electronic-invoicing/suppliers?search=QA Proveedor FE Base` | PASS | HTTP 200, fixture encontrado. |
| `GET /api/electronic-invoicing/suppliers/:id` | PASS | HTTP 200. |
| `POST /api/electronic-invoicing/suppliers/lookup` | WARN | HTTP 201, `provider=NONE`, `lookupStatus=SKIPPED`. |

## Productos, units, taxes, promociones e inventario loteado

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/units` | PASS | HTTP 200, 4 unidades: `UND`, `KG`, `LT`, `CJ`. |
| `GET /api/taxes` | PASS | HTTP 200, 2 impuestos: `IVA 19%`, `Exento`. |
| `GET /api/products?branchId=<branch>` | PASS | HTTP 200, 6 productos, fixture `QA-BASE-LOT-001` encontrado. |
| `GET /api/products/:id` | PASS | HTTP 200, producto fixture requiere lote y vencimiento. |
| `GET /api/pricing/promotions` | PASS | HTTP 200, endpoint operativo. |
| `POST /api/pricing/preview-line` | PASS | HTTP 201, preview pricing operativo para producto QA. |
| `GET /api/inventory/lot-balances?branchId=<branch>&onlyAvailable=true&onlyActiveLots=true` | PASS | HTTP 200, fixture de lote encontrado. |
| `GET /api/inventory/lot-balances/:id` | PASS | HTTP 200, `quantityAvailable=25`. |

Fixtures validados:

- Producto: `QA-BASE-LOT-001`.
- Lote: `QA-LOT-MVP-01-2B-001`.
- Cantidad disponible: `25`.

## Resultado QA

Los bloqueos que motivaron el rerun quedaron resueltos:

- `GET /customers/default`: PASS.
- `POST /customers/default/ensure`: PASS.
- `units > 0`: PASS.
- `taxes > 0`: PASS.
- producto demo fixture: PASS.
- lote demo fixture: PASS.
- Clientes FE y Proveedores FE por endpoints protegidos: PASS con `SUPER_ADMIN`.
- Promociones/pricing: PASS.

Advertencia no bloqueante:

- Lookup FE responde, pero runtime esta en `provider=NONE`, `lookupStatus=SKIPPED`. No se validaron escenarios `FOUND`/`NOT_FOUND` de provider mock en este rerun.

## Restricciones cumplidas

- No se modifico codigo.
- No se ejecutaron migraciones.
- No se ejecuto bootstrap.
- No se hizo deploy.
- No se reinicio PM2.
- No se hicieron escrituras directas en DB.
- No se imprimieron secretos ni tokens.

## Decision

```text
QA_OPERATIVO_CLIENTES_PROVEEDORES_PRODUCTOS_READY
```
