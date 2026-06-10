# Evidencia frontend promotions admin QA fase 6.9.2

Fecha: 2026-06-02
Rama: `feat/frontend-promotions-admin-qa-fase-6-9-2`

## Alcance

QA local controlado de administracion de promociones y reflejo en POS mediante `POST /api/pricing/preview-line`.

No se modifico logica funcional. No se modifico backend, SQL, frontend funcional, POS venta, Orders, facturacion electronica, DIAN/GetAcquirer ni suppliers.

## Ambiente usado

- DB local/copia QA: `::1/128:5432`, `current_database() = manus_tienda_prd`.
- API local: `http://localhost:4020/api`.
- Web local ya disponible: `http://localhost:3000` y `http://localhost:3029`.
- No se levantaron servicios nuevos para esta fase.
- No se guardaron tokens completos ni credenciales en evidencia.
- In-app browser no usable: `node_repl` fallo dos veces con `windows sandbox failed: spawn setup refresh`. No habia Playwright/Puppeteer local instalado. Por eso la ruta se valido por HTTP y los flujos se validaron por API local.

## A. Acceso a pantalla

- `GET http://localhost:3000/default/inventory/promotions`: `200`.
- `GET http://localhost:3029/default/inventory/promotions`: `200`.
- `npm run build` genero la ruta `/[tenant]/inventory/promotions`.
- No cae en 404.
- Usuario QA local con rol `SUPER_ADMIN`: `hasMenuAccess(MENU_KEYS.INVENTORY_PROMOTIONS, READ/WRITE)` permite acceso por rol privilegiado.
- API de promociones respondio con el token local, confirmando permiso backend para listar/crear/editar/inactivar.

Observacion: `GET /api/auth/menu` no incluyo `INVENTORY_PROMOTIONS` en la respuesta local. Para `SUPER_ADMIN` no bloquea por bypass de rol, pero queda riesgo para QA con roles no privilegiados.

## Bug encontrado 1: referencias de la pantalla con tenant slug

La pagina `web/app/[tenant]/inventory/promotions/page.tsx` usa `routeTenant` como `tenantId` al cargar productos y sucursales:

- `listProducts({ tenantId: routeTenant })`
- `listBranches({ tenantId: routeTenant })`

En la ruta local `/{tenant}` el valor es `default` (slug), pero el backend espera UUID o ausencia del filtro.

Evidencia API:

- `GET /api/inventory/products`: `200`, `12` productos.
- `GET /api/inventory/products?tenantId=default`: `500`.
- `GET /api/branches`: `200`, `2` sucursales.
- `GET /api/branches?tenantId=default`: `500`.

Impacto: en `/default/inventory/promotions`, el modal de crear/editar puede no cargar productos ni sucursales. Esto bloquea crear promociones desde UI aunque los endpoints de promociones funcionen.

No se corrigio por restriccion de la fase.

## B. Listado y filtros

Validado por API local:

- `GET /api/pricing/promotions?isActive=true`: OK.
- `GET /api/pricing/promotions?isActive=false&search=QA692-...`: OK.
- `GET /api/pricing/promotions?search=QA692-...`: OK.

Resultado:

- Antes del fixture: `activeBeforeCount = 0`.
- Luego de crear fixtures: filtro activo encontro las promociones activas.
- Luego de inactivar una promocion: filtro inactivo encontro la promocion inactivada.

## C. Crear promocion PERCENTAGE

Producto local usado:

- SKU: `PROD-ACEITE-001`.
- Precio base: `10200`.
- Product id prefix: `30000000`.
- Branch id prefix: `dc1b81e0`.

Promocion creada:

- Nombre: `QA692-20260602201149-PERCENTAGE`.
- Tipo: `PERCENTAGE`.
- Valor inicial: `10`.
- Estado: activa.

Resultado: creada y listada.

## D. Crear o validar FIXED_AMOUNT

Promocion valida creada:

- Nombre: `QA692-20260602201149-FIXED`.
- Tipo: `FIXED_AMOUNT`.
- Valor: `5`.
- Estado: activa.

Validacion adicional:

- Se intento crear `FIXED_AMOUNT` con `discountValue = 0`.
- Resultado API: `200`.
- El frontend si bloquea esto en `validateForm`: `FIXED_AMOUNT debe ser mayor a 0.`

Bug encontrado 2: backend acepta `FIXED_AMOUNT = 0`, inconsistente con UX y contrato esperado.

## E. Crear o validar SPECIAL_PRICE

Promocion valida creada:

- Nombre: `QA692-20260602201149-SPECIAL`.
- Tipo: `SPECIAL_PRICE`.
- Valor: `10198`.
- Estado: activa.

Validacion adicional:

- `SPECIAL_PRICE = -1`: API respondio `400`.
- `PERCENTAGE = 101`: API respondio `400`.

## F. Editar promocion

Se edito la promocion `PERCENTAGE`:

- Nombre final: `QA692-20260602201149-PERCENTAGE-EDIT`.
- Valor final: `12`.
- `priority`: `0`.
- Vigencia extendida.

Resultado: `editPersisted = true`.

## G. Inactivar promocion

Se inactivo la promocion `FIXED_AMOUNT`.

Resultado:

- `fixedInactive = true`.
- Filtro inactivo encontro `1` fila del fixture en ese momento.

## H. POS preview-line

Se ejecuto `POST /api/pricing/preview-line` con:

- Producto: `PROD-ACEITE-001`.
- Cantidad: `2`.
- Canal: `POS`.
- Sucursal: `dc1b81e0...`.

Resultado:

- Promocion aplicada: `QA692-20260602201149-PERCENTAGE-EDIT`.
- `appliedExpectedPromotion = true`.
- `baseUnitPrice = 10200`.
- `finalUnitPrice = 8976`.
- `discountAmount = 1224`.
- `lineTotal = 17952`.

Esto confirma que `preview-line` refleja la promocion activa y calcula precio final, descuento, nombre de promocion y total de linea.

Limitacion: no se pudo confirmar visualmente el carrito POS por bloqueo del in-app browser. La validacion fue directa sobre el contrato que consume el POS.

## I. Cleanup

Cleanup logico ejecutado por API:

- Se inactivaron las promociones creadas por la fase.
- El intento `FIXED_AMOUNT = 0` dejo una fila activa adicional porque backend lo acepto; se detecto y se inactivo.
- `activeRemaining = 0` para `search=QA692-`.
- `fixtureRowsRemainingLogical = 4`: filas inactivas quedan porque la API no expone delete fisico.

## Validaciones ejecutadas

- OK: `cd web && npm run lint`.
  - Pasa con warnings preexistentes de hooks deps y `<img>`.
- OK: `cd web && npm run build`.
  - Compila y lista `/[tenant]/inventory/promotions`.
  - Pasa con los mismos warnings preexistentes.
- OK: `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json`.
  - `valid: true`.
- OK: `git diff --check`.
  - Sin errores.

## Bugs y riesgos

1. Bug bloqueante UI: `/default/inventory/promotions` pasa slug `default` como `tenantId` para productos/sucursales. Backend responde `500`. El formulario puede quedarse sin productos y no permitir crear promociones desde UI.
2. Bug backend/contrato: `POST /api/pricing/promotions` acepta `FIXED_AMOUNT` con `discountValue = 0`. Frontend lo bloquea, pero API lo crea.
3. Riesgo permisos: `/api/auth/menu` local no incluyo `INVENTORY_PROMOTIONS`; `SUPER_ADMIN` no se bloquea por bypass, pero falta validar rol `ADMIN` no privilegiado si aplica.
4. Limitacion de QA: no hubo screenshot ni click real por bloqueo del in-app browser.

## Confirmacion de no tocado

No se toco logica funcional, backend, SQL, frontend funcional, POS venta, Orders, facturacion electronica, DIAN/GetAcquirer, suppliers, PRD real, remoto ni commits.
