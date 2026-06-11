# Evidencia QA operativo integral MVP-01.2

Fecha: 2026-06-10 America/Bogota. Ventana UTC: 2026-06-11 01:55-02:02.

Cambio OpenSpec: `mvp-web-hardening`

Resultado: `QA_OPERATIVO_CLIENTES_PROVEEDORES_PRODUCTOS_BLOCKED`

Motivo: Clientes FE, Proveedores FE, Productos, Impuestos y Promociones fueron ejercitados por API QA con datos controlados. El flujo queda bloqueado porque el cliente consumidor final no se puede resolver/asegurar y el lookup fiscal de terceros esta deshabilitado en QA.

## Ambiente

| Item | Valor |
| --- | --- |
| API QA | `https://api.apptiendamanus.space/api` |
| DB esperada | `manus_tienda_qa` |
| Rama/release esperado | `release/evolutivo/0.0.1` |
| Actor QA | `SUPER_ADMIN` |
| Tenant | `Tenant Principal` |
| Sucursal | `Sucursal Principal` |

No se imprimieron tokens, refresh tokens, passwords ni `.env`.

## Resumen

| Bloque | Estado | Evidencia |
| --- | --- | --- |
| Auth/contexto | PASS/WARN | Login `SUPER_ADMIN` OK. `SESSION_ACTIVE` observado y resuelto con `/auth/login/force`. |
| Clientes FE | FAIL | Listado, creacion, edicion, consulta por id y persistencia PASS. Consumidor final FAIL. |
| Lookup Clientes FE | WARN | Endpoint responde, pero provider `NONE`, mode `disabled`, status `SKIPPED`. |
| Proveedores FE | PASS | Listado, creacion, edicion, consulta por id y persistencia PASS. |
| Lookup Proveedores FE | WARN | Endpoint responde, pero provider `NONE`, mode `disabled`, status `SKIPPED`. |
| Productos | PASS/WARN | Producto, SKU, barcode principal, barcode alterno, unidad, impuesto y activo PASS. Unidades base activas WARN: `0`. |
| Inventario loteado | WARN | Endpoint responde HTTP 200, pero no hay lotes disponibles sin crear inventario. |
| Impuestos | PASS/WARN | Listado PASS, base activa WARN: `0`; impuesto QA controlado creado/asociado/limpiado PASS. |
| Promociones | PASS/WARN | Listado, creacion API y preview pricing PASS; UI no ejercitada. |
| Limpieza QA | PASS | Datos QA creados fueron desactivados o soft-deleted por API. |

## Auth y contexto

| Check | Estado | Resultado |
| --- | --- | --- |
| `POST /api/auth/login` | WARN | `SESSION_ACTIVE` observado. |
| `POST /api/auth/login/force` | PASS | Sesion QA autenticada sin exponer token/password. |
| `GET /api/auth/context` | PASS | Tenant y sucursal resueltos. |

## Clientes FE

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/electronic-invoicing/customers?isActive=true` | PASS | HTTP 200, listado visible. |
| `GET /api/electronic-invoicing/customers/default` | FAIL | HTTP 404. |
| `POST /api/electronic-invoicing/customers/default/ensure` | FAIL | HTTP 409. |
| `POST /api/electronic-invoicing/customers` | PASS | Cliente FE completo creado con datos QA. |
| `GET /api/electronic-invoicing/customers/:id` | PASS | Consulta por id validada en follow-up GET. |
| `PATCH /api/electronic-invoicing/customers/:id` | PASS | Persistio `phone` y `taxResponsibilities`. |

Campos validados:

| Campo requerido | Campo API observado | Estado |
| --- | --- | --- |
| `documentTypeCode` | `31` | PASS |
| `documentNumber` | QA generado | PASS |
| `dv` | `verificationDigit` | PASS |
| `taxResponsibilities` | `R-99-PN`, `O-13` | PASS |
| `municipalityCode` | `11001` | PASS |
| `departmentCode` | `11` | PASS |
| `countryCode` | `CO` | PASS |
| `email` | `fiscalEmail` / `invoiceEmail` QA | PASS |
| `phone` | QA editado | PASS |

Bloqueo exacto: no se pudo validar consumidor final activo. `GET /default` devuelve 404 y `POST /default/ensure` devuelve 409.

## Lookup Clientes FE

| Check | Estado | Resultado |
| --- | --- | --- |
| Documento valido | WARN | `provider=NONE`, `mode=disabled`, `lookupStatus=SKIPPED`. |
| Documento inexistente | WARN | `provider=NONE`, `lookupStatus=SKIPPED`; no se obtiene `NOT_FOUND`. |
| Timeout/provider error mock | WARN | El adapter `MOCK_LOCAL` versionado no tiene trigger de timeout/error; en QA ademas esta `disabled`. |
| Apply lookup | PASS | Persistio `dianLastLookupStatus=SKIPPED` y `dianLastLookupAt`. |

Bloqueo: QA no permite validar escenarios `FOUND`/`NOT_FOUND` porque el lookup fiscal esta deshabilitado.

## Proveedores FE

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/electronic-invoicing/suppliers?isActive=true` | PASS | HTTP 200. |
| `POST /api/electronic-invoicing/suppliers` | PASS | Proveedor FE completo creado con datos QA. |
| `GET /api/electronic-invoicing/suppliers/:id` | PASS | Consulta por id validada en follow-up GET. |
| `PATCH /api/electronic-invoicing/suppliers/:id` | PASS | Persistio `phone` y `taxResponsibilities`. |

Campos validados:

| Campo requerido | Campo API observado | Estado |
| --- | --- | --- |
| `documentTypeCode` | `31` | PASS |
| `documentNumber` | QA generado | PASS |
| `dv` | `verificationDigit` | PASS |
| `taxResponsibilities` | `R-99-PN`, `O-13` | PASS |
| `municipalityCode` | `05001` | PASS |
| `departmentCode` | `05` | PASS |
| `countryCode` | `CO` | PASS |
| `email` | `fiscalEmail` / `invoiceEmail` QA | PASS |
| `phone` | QA editado | PASS |

## Lookup Proveedores FE

| Check | Estado | Resultado |
| --- | --- | --- |
| Documento valido | WARN | `provider=NONE`, `mode=disabled`, `lookupStatus=SKIPPED`. |
| Documento inexistente | WARN | `provider=NONE`, `lookupStatus=SKIPPED`; no se obtiene `NOT_FOUND`. |
| Timeout/provider error mock | WARN | El adapter `MOCK_LOCAL` versionado no tiene trigger de timeout/error; en QA ademas esta `disabled`. |
| Apply lookup | PASS | Persistio `fiscalLastLookupStatus=SKIPPED` y `fiscalLastLookupAt`. |

## Productos

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/units` | WARN | Base QA tenia `0` unidades activas antes del setup controlado. |
| Setup unidad QA por API | PASS | Unidad QA creada y luego soft-deleted. |
| `GET /api/products?branchId=:branchId` | PASS | HTTP 200. |
| `POST /api/products` | PASS | SKU `QA-MVP012-MVP012P20260610210210` creado. |
| Barcode principal | PASS | `barcode=7700610210215`, `isPrimary=true`. |
| Barcode alterno | PASS | `barcode=QAALTMVP012P20260610210210`, `isPrimary=false`. |
| `GET /api/products/:id/barcodes` | PASS | Principal y alterno visibles. |
| `GET /api/products/:id` | PASS | SKU, unidad, impuesto y `isActive=true` validados. |
| `PUT /api/products/:id` | PASS | Persistio nombre, descripcion, `minStock=2`, `maxStock=120`. |

## Inventario loteado

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/inventory/lot-balances?branchId=:branchId&onlyAvailable=true&onlyActiveLots=true` | WARN | HTTP 200, pero no hay lotes disponibles para inspeccionar sin alterar inventario. |
| No alterar inventario real | PASS | Solo se ejecuto `GET`; no se crearon lotes ni movimientos. |

No se pudo validar visualmente `lotes`, `fecha vencimiento`, `cantidad disponible` y `trazabilidad` con registros reales porque el endpoint no devolvio lotes.

## Impuestos

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/taxes` | PASS/WARN | HTTP 200; base QA tenia `0` impuestos activos antes del setup controlado. |
| Setup impuesto QA por API | PASS | Impuesto activo QA creado y luego soft-deleted. |
| Asociacion producto-impuesto | PASS | Producto creado con `taxId` del impuesto QA activo. |

## Promociones

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/pricing/promotions?isActive=true` | PASS | HTTP 200, sin promociones activas base. |
| Creacion UI | WARN | No se ejercito UI en esta corrida; se valido creacion controlada por API. |
| `PERCENTAGE` | PASS | Creacion PASS; preview `finalUnitPrice=11110.5`, `discountAmount=1234.5`. |
| `FIXED_AMOUNT` | PASS | Creacion PASS; preview `finalUnitPrice=11345`, `discountAmount=1000`. |
| `SPECIAL_PRICE` | PASS | Creacion PASS; preview `finalUnitPrice=9999`, `discountAmount=2346`. |

Endpoint preview validado:

```text
POST /api/pricing/preview-line
```

## Limpieza

| Objeto QA | Estado |
| --- | --- |
| Clientes QA | PASS: desactivados por API |
| Proveedores QA | PASS: desactivados por API |
| Promociones QA | PASS: desactivadas por API |
| Barcodes QA | PASS: desactivados por API |
| Producto QA | PASS: soft-deleted por API |
| Impuesto QA | PASS: soft-deleted por API |
| Unidad QA | PASS: soft-deleted por API |

## Restricciones cumplidas

- No se modifico codigo.
- No se ejecutaron migraciones.
- No se toco PM2.
- No se hizo deploy.
- No se tocaron datos productivos.
- No se ejecutaron escrituras manuales en DB.
- No se altero inventario real.
- Solo se hicieron operaciones QA controladas por API.
- No se expusieron secretos.

## Decision

No se emite `QA_OPERATIVO_CLIENTES_PROVEEDORES_PRODUCTOS_READY`.

Estado emitido:

```text
QA_OPERATIVO_CLIENTES_PROVEEDORES_PRODUCTOS_BLOCKED
```

Bloqueos exactos:

1. Cliente consumidor final: `GET /api/electronic-invoicing/customers/default` devuelve HTTP 404 y `POST /api/electronic-invoicing/customers/default/ensure` devuelve HTTP 409.
2. Lookup terceros FE en QA: `provider=NONE`, `mode=disabled`, `lookupStatus=SKIPPED`; no se pueden validar escenarios `FOUND` ni `NOT_FOUND`.
3. Datos base QA incompletos: `GET /api/units` y `GET /api/taxes` no tienen activos base; productos/promociones se validaron con setup QA controlado y cleanup.
4. Inventario loteado: `GET /api/inventory/lot-balances` responde HTTP 200, pero no hay lotes disponibles para validar vencimiento/cantidad/trazabilidad sin crear inventario.
