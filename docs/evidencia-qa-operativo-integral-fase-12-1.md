# Evidencia QA - Fase 12.1 - QA Operativo Integral

## Objetivo

Validar integralmente la plataforma MOCK de perifericos implementada entre Fase 2 y Fase 12 antes de iniciar cualquier trabajo con hardware real.

## Alcance

- backend-perifericos MOCK.
- API `pos-terminals`.
- Web `/[tenant]/admin/peripherals`.
- Contratos Web de perifericos.
- Integraciones Web de ventas, compras, pedidos, scanner y balanza.
- Modelo de productos pesables y codigos de barras.

No se conecto hardware real. No se activo `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.

## Ambiente utilizado

- Repositorio: `D:/Profe/manus-tienda`.
- Rama: `feat/develop/pos-peripherals-platform`.
- Change OpenSpec: `add-pos-peripherals-platform`.
- API local: `http://localhost:4020/api`.
- backend-perifericos: `http://localhost:4050`.
- DB local segun `scripts/config/db.env`: `localhost:5432/manus_tienda_prd`.
- Fecha de ejecucion: `2026-06-05`.

## Migraciones aplicadas

Se aplicaron de forma idempotente solo:

- `scripts/database/migrations/V053__products_sale_model_phase_11_1.sql`.
- `scripts/database/migrations/V054__pos_terminal_peripheral_settings_phase_12.sql`.

Resultado:

- V053: columnas `products.sale_type` y `products.measurement_unit` ya existian; migracion re-aplicada sin error.
- V054: tablas `pos_terminals` y `pos_terminal_peripheral_settings` ya existian; migracion re-aplicada sin error.
- Ambas quedaron registradas en `public.migrations_history`.

## Terminal utilizada

Endpoint:

```text
GET /api/pos-terminals/resolve-current?tenantId=00000000-0000-0000-0000-000000000001
```

Resultado:

```text
source=CONFIGURED
terminal=local-terminal
printer=mock-printer-001
drawer=mock-cashdrawer-001
scale=mock-scale-001
scanner=mock-scanner-001
branch=ab41d3da-6686-4de3-9191-875a5a7da5a5
```

## Resultados por caso QA

### Caso 1 - Terminal configurada

Resultado: PASS.

- `resolve-current` devuelve `CONFIGURED`.
- `GET /api/pos-terminals` devuelve 1 terminal.
- Terminal: `local-terminal`.
- Mode: `MOCK`.
- Devices configurados: `mock-printer-001`, `mock-cashdrawer-001`, `mock-scale-001`, `mock-scanner-001`.

### Caso 2 - Venta MOCK

Resultado: PASS por inspeccion de flujo y build.

- `web/modules/pos/components/PosScreen.tsx` ejecuta perifericos despues de `createSale()`.
- `web/domains/peripherals/pos-sale-integration.ts` usa `printSaleTicket()`.
- Caja abre solo con `PaymentMethod.tipo === "CASH"`.
- Reason: `SALE_CASH_PAYMENT`.
- Error de periferico no revierte venta; retorna feedback warning.

No se creo venta real por navegador en esta corrida. Riesgo pendiente: smoke manual autenticado completo.

### Caso 3 - Compra MOCK

Resultado: PASS por inspeccion de flujo y build.

- `web/modules/inventory/components/PurchaseForm.tsx` ejecuta perifericos despues de `createPurchase()`.
- `web/domains/peripherals/purchase-integration.ts` usa `printPurchaseTicket()`.
- Caja abre solo con pago/egreso efectivo.
- Reason: `PURCHASE_CASH_PAYMENT`.
- Compra `CREDIT` o sin pago inmediato no abre caja.

No se creo compra real por navegador en esta corrida. Riesgo pendiente: smoke manual autenticado completo.

### Caso 4 - Pedido MOCK

Resultado: PASS por inspeccion de flujo y build.

- `OrderForm` y `OrderDeliverForm` persisten antes de ejecutar perifericos.
- `web/domains/peripherals/order-integration.ts` usa `printOrderTicket()`.
- Caja abre solo con pago efectivo nuevo.
- Reason: `ORDER_CASH_PAYMENT`.
- Pedido pendiente sin pago no abre caja.

No se creo pedido real por navegador en esta corrida. Riesgo pendiente: smoke manual autenticado completo.

### Caso 5 - Scanner MOCK

Resultado: PASS.

Agent:

```text
POST /scanner/simulate code=46564567 -> success=true
POST /scanner/simulate code=99999999 -> success=true
```

WebSocket:

```text
scanner.code.read code=46564567
```

Catalogo POS:

```text
PRODUCTS count=6
BARCODE_MATCH name=Aceite saleType=UNIT unit=UND stock=145 primary=46564567
barcodeCodes=46564567
```

Codigo inexistente `99999999` queda como evento tecnico; POS muestra warning controlado por matcher cuando no hay producto.

### Caso 6 - Balanza MOCK

Resultado: PASS.

Endpoint:

```text
GET /scale/current-weight
```

Respuesta:

```json
{"deviceId":"mock-scale-001","weight":1.25,"unit":"kg","stable":true}
```

POS usa `saleType` formal para producto pesable. Producto `UNIT` no recibe peso automatico.

### Caso 7 - Fallback MOCK

Resultado: PASS.

Cobertura:

- `PosTerminalsService` test `resolves fallback MOCK when terminal is not configured`.
- `resolvePeripheralTerminalConfig()` captura error de API config y usa fallback local.

Fallback esperado:

```json
{
  "terminalId": "local-terminal",
  "printerDeviceId": "mock-printer-001",
  "cashDrawerDeviceId": "mock-cashdrawer-001",
  "scaleDeviceId": "mock-scale-001",
  "scannerDeviceId": "mock-scanner-001",
  "source": "FALLBACK_MOCK"
}
```

### Caso 8 - Agent offline

Resultado: PASS.

Smoke TS con `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL=http://localhost:4059`:

```json
{"success":false,"code":"AGENT_OFFLINE","message":"El agente local de perifericos no esta disponible en localhost:4050."}
```

El contrato retorna error controlado. No lanza stack trace hacia componentes.

### Caso 9 - Admin Peripherals

Resultado: PASS por endpoints, WebSocket y build.

Validado:

- `GET /health` responde `status=ok`, `mode=MOCK`.
- `GET /devices` devuelve impresora, caja, balanza y scanner MOCK.
- `GET /logs` devuelve logs tecnicos.
- Test print MOCK devuelve `adapterName=MockPrinterAdapter`, `profile=THERMAL_80MM` y preview.
- Caja MOCK devuelve `adapterName=MockCashDrawerAdapter` y `CASH_DRAWER_PULSE`.
- WebSocket local recibio `scanner.code.read`.
- Registro NETWORK temporal funciona.
- Impresion NETWORK con flag real apagado devuelve 400 controlado:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Real peripheral adapters are disabled. Enable PERIPHERALS_ENABLE_REAL_ADAPTERS=true to use them."
}
```

La ruta `/[tenant]/admin/peripherals` compila en build Web.

### Caso 10 - RBAC

Resultado: PASS por DB/API seed.

`POS_PERIPHERALS` asignado a:

```text
ADMIN|WRITE|{"read": true, "manage": true}
SUPER_ADMIN|WRITE|{"read": true, "manage": true}
SUPER_USER|WRITE|{"read": true, "manage": true}
```

`USER` no tiene asignacion default.

### Caso 11 - Productos pesables

Resultado: PASS.

Catalogo POS local:

```text
SALETYPE WEIGHT count=1
SALETYPE UNIT count=3
SALETYPE BOTH count=2
```

Ejemplos:

```text
Cafe saleType=WEIGHT unit=KG
Aceite saleType=UNIT unit=UND
Azucar saleType=BOTH unit=LB
```

POS usa `saleType` como fuente principal para `isWeighableProduct()`.

### Caso 12 - Build integral

Resultado: PASS.

- `api npm.cmd run build`: PASS.
- `api npx.cmd tsx --test "src/**/*.spec.ts"`: PASS, 378 tests, 377 pass, 1 skipped.
- `web npm.cmd run build`: PASS.
- `backend-perifericos npm.cmd run build`: PASS.
- `backend-perifericos npm.cmd test`: PASS, 33 pass.

Nota: `web npm.cmd test` no se ejecuto porque `web/package.json` no define script `test`.

## Bugs encontrados

### Bug 1 - Scanner feature flag

`subscribeScannerEvents()` no respetaba `NEXT_PUBLIC_PERIPHERALS_SCANNER_ENABLED=false`.

Impacto:

- Podia abrir WebSocket aunque scanner estuviera deshabilitado por env.

Fix:

- Se agrego guard clause en `web/domains/peripherals/contracts.ts`.
- Smoke posterior:

```json
{"opened":false}
```

### Bug 2 - Cache `.next`

Un rebuild Web fallo por modulo stale de `.next`:

```text
PageNotFoundError: Cannot find module for page: /[tenant]/configuracion/menu
```

Fix operativo:

- Se elimino solo `web/.next` con path resuelto dentro del workspace.
- Rebuild posterior: PASS.

## Fixes realizados

- `web/domains/peripherals/contracts.ts`: `subscribeScannerEvents()` retorna noop cuando `NEXT_PUBLIC_PERIPHERALS_ENABLED=false` o `NEXT_PUBLIC_PERIPHERALS_SCANNER_ENABLED=false`.
- Limpieza operativa de cache generado `web/.next` para repetir build.

## Comandos ejecutados

```text
api: npm.cmd run build
api: npx.cmd tsx --test "src/**/*.spec.ts"
web: npm.cmd run build
backend-perifericos: npm.cmd run build
backend-perifericos: npm.cmd test
openspec.cmd validate add-pos-peripherals-platform --type change --strict
git diff --check
git status --short
```

## Resultado OpenSpec validate

PASS.

```text
Change 'add-pos-peripherals-platform' is valid
```

## Resultado git diff --check

PASS.

Solo se observaron warnings de conversion LF -> CRLF en archivos ya modificados del worktree.

## Riesgos pendientes

- Smoke manual autenticado completo en navegador para venta, compra y pedido queda pendiente como validacion final de negocio local.
- DB local se llama `manus_tienda_prd`; se uso porque `ENVIRONMENT=dev` y host es `localhost`.
- Mensaje offline de agent mantiene texto `localhost:4050` aunque el smoke uso puerto alterno `4059`.

## Restricciones cumplidas

- No hardware real.
- No USB.
- No serialport.
- No HID.
- No drivers.
- No Electron.
- No Capacitor.
- No se activo `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No se modifico `backend-reporteria/`.
- No se modifico logica fiscal.
- No se avanzo a Fase 13 ni Fase 14.
