# Evidencia QA - Fase 12 - Configuracion terminal perifericos

## Objetivo

Crear configuracion operativa por tenant, sucursal y terminal POS para dejar de depender exclusivamente de `local-terminal` y devices `mock-*` fijos.

## Problema resuelto

Antes, los contratos de perifericos usaban defaults globales:

- `local-terminal`
- `mock-printer-001`
- `mock-cashdrawer-001`
- `mock-scale-001`
- `mock-scanner-001`

Ahora existe una configuracion central que puede resolver terminal y devices por tenant/sucursal/terminal. Si no hay configuracion, el sistema conserva fallback MOCK seguro.

## Migracion creada

Archivo:

- `scripts/database/migrations/V054__pos_terminal_peripheral_settings_phase_12.sql`

Incluye:

- Tabla `pos_terminals`.
- Tabla `pos_terminal_peripheral_settings`.
- Constraints de modo `MOCK`, `REAL`, `HYBRID`.
- Unique `(tenant_id, branch_id, code)`.
- Indices por tenant/sucursal/active.
- Trigger `updated_at`.
- Seed local/QA de `local-terminal` para tenant default si existe sucursal principal.

Nota operativa:

- Migracion pensada para local/QA.
- No aplicar en PRD sin aprobacion operativa.

## Modelo DB

`pos_terminals`:

- `id`
- `tenant_id`
- `branch_id`
- `code`
- `name`
- `description`
- `active`
- `mode`
- `created_at`
- `updated_at`

`pos_terminal_peripheral_settings`:

- `terminal_id`
- `printer_device_id`
- `cash_drawer_device_id`
- `scale_device_id`
- `scanner_device_id`
- `enable_print_sale`
- `enable_print_purchase`
- `enable_print_order`
- `enable_open_drawer`
- `enable_scale`
- `enable_scanner`

## Endpoints creados

Modulo API:

- `api/src/modules/pos-terminals/`

Endpoints:

- `GET /api/pos-terminals`
- `GET /api/pos-terminals/:id`
- `POST /api/pos-terminals`
- `PATCH /api/pos-terminals/:id`
- `GET /api/pos-terminals/:id/peripherals`
- `PUT /api/pos-terminals/:id/peripherals`
- `GET /api/pos-terminals/resolve-current`

## Reglas RBAC/contexto

- CRUD/settings usan `MENU_KEYS.POS_PERIPHERALS`.
- CRUD/settings quedan para `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`.
- `resolve-current` queda disponible para roles autenticados incluyendo `USER`.
- `ADMIN` queda limitado a su `tenantId` del JWT.
- `SUPER_ADMIN` y `SUPER_USER` pueden filtrar por `tenantId`.
- Se valida que `branchId` pertenezca al tenant.

## Fallback MOCK

Si no existe terminal configurada o la API config no esta disponible, Web usa:

```json
{
  "terminalId": "local-terminal",
  "printerDeviceId": "mock-printer-001",
  "cashDrawerDeviceId": "mock-cashdrawer-001",
  "scaleDeviceId": "mock-scale-001",
  "scannerDeviceId": "mock-scanner-001",
  "features": {
    "printSale": true,
    "printPurchase": true,
    "printOrder": true,
    "openDrawer": true,
    "scale": true,
    "scanner": true
  },
  "source": "FALLBACK_MOCK"
}
```

MOCK sigue siendo comportamiento seguro por defecto.

## UI creada/actualizada

Ruta:

- `/[tenant]/admin/peripherals`

Panel agregado:

- `Terminal POS`

Permite:

- Resolver terminal actual.
- Ver origen `CONFIGURED` o `FALLBACK_MOCK`.
- Crear terminal basica.
- Seleccionar terminal configurada.
- Asignar `printer_device_id`.
- Asignar `cash_drawer_device_id`.
- Asignar `scale_device_id`.
- Asignar `scanner_device_id`.
- Activar/desactivar impresion ventas/compras/pedidos.
- Activar/desactivar apertura de caja.
- Activar/desactivar balanza.
- Activar/desactivar scanner.

Los device ids pueden escribirse manualmente o elegirse desde `GET /devices` mediante datalist.

## Integracion con contratos

Archivo:

- `web/domains/peripherals/contracts.ts`

Contratos actualizados:

- `printSaleTicket()`
- `printPurchaseTicket()`
- `printOrderTicket()`
- `openCashDrawer()`
- `readCurrentWeight()`
- `simulateScannerRead()`
- `subscribeScannerEvents()`

Regla aplicada:

- Primero se revisan flags env frontend.
- Luego se resuelve configuracion terminal.
- Si setting terminal esta apagado, retorna `OPERATION_DISABLED`.
- Si API config falla, usa fallback MOCK.

## Comandos ejecutados

| Comando | Resultado |
| --- | --- |
| `cd api && npm.cmd run build` | PASS |
| `cd api && npx.cmd tsx --test "src/**/*.spec.ts"` | PASS. 378 tests, 377 pass, 1 skipped. |
| `cd web && npm.cmd run build` | PASS. Warnings preexistentes de hooks/img y browserslist. |
| `cd web && npm.cmd test` | No ejecutado. `web/package.json` no define script `test`. |
| `cd backend-perifericos && npm.cmd run build` | PASS |
| `cd backend-perifericos && npm.cmd test` | PASS. 33 tests pass. |
| `openspec.cmd validate add-pos-peripherals-platform --type change --strict` | PASS. Change valid. |
| `git diff --check` | PASS. Solo warnings CRLF existentes. |
| `git status --short` | PASS ejecutado. Working tree dirty esperado por fases de perifericos. |

## Smoke manual

No se ejecuto smoke manual navegador/DB en esta corrida. Requiere aplicar `V054__pos_terminal_peripheral_settings_phase_12.sql` en DB local y levantar API/Web/backend-perifericos.

Smoke esperado:

1. Abrir `/00000000-0000-0000-0000-000000000001/admin/peripherals`.
2. Resolver terminal.
3. Crear o seleccionar `local-terminal`.
4. Guardar:
   - `printer_device_id = mock-printer-001`
   - `cash_drawer_device_id = mock-cashdrawer-001`
   - `scale_device_id = mock-scale-001`
   - `scanner_device_id = mock-scanner-001`
5. Ir a POS.
6. Validar venta, ticket MOCK, caja MOCK, scanner MOCK y balanza MOCK.

## Riesgos pendientes

- Falta smoke manual con DB migrada.
- Validacion por sucursal de usuario final se mantiene por tenant/branch existente; no se agrego matriz avanzada de permisos por sucursal.
- `REAL/HYBRID` quedan modelados pero no activan hardware real.
- No se guarda configuracion sensible de red real en estas tablas.

## Restricciones cumplidas

- No hardware real.
- No `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No USB real.
- No serial real.
- No HID real.
- No drivers.
- No Electron.
- No Capacitor.
- No `backend-reporteria/`.
- No reglas fiscales.
- No reporterias.
- MOCK sigue con fallback por defecto.
- No avance a Fase 13.
