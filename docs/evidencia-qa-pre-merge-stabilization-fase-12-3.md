# Evidencia QA - Fase 12.3 - Pre-merge Stabilization

## Objetivo

Validar que la rama `feat/develop/pos-peripherals-platform` queda estable para PR/MR o merge controlado hacia `develop`, sin implementar funcionalidades nuevas.

## Alcance

- Cambio OpenSpec: `add-pos-peripherals-platform`.
- Rama: `feat/develop/pos-peripherals-platform`.
- Areas revisadas: `api/`, `web/`, `backend-perifericos/`, `scripts/database/`, `docs/` y `openspec/changes/add-pos-peripherals-platform/`.
- No se hizo commit.
- No se hizo merge.
- No se avanzo a Fase 13.

## Estado Git

Comandos:

- `git branch --show-current`: `feat/develop/pos-peripherals-platform`.
- `git status --short`: worktree con cambios esperados de fases 2 a 12.3.
- `git diff --check`: PASS con warnings CRLF/LF de Git.

Resumen de estado:

- Archivos modificados versionados: 27.
- Archivos/directorios nuevos no trackeados: evidencias QA, `backend-perifericos/`, `web/domains/peripherals/`, `web/app/[tenant]/admin/`, `api/src/modules/pos-terminals/`, migraciones V053/V054 y OpenSpec local.
- No se detectaron archivos temporales `*.tmp`, `*.log`, `debug*`, `npm-debug*`, `yarn-error*` o `pnpm-debug*` en `git status`.

## OpenSpec

Comandos:

- `openspec.cmd status --change add-pos-peripherals-platform --json`.
- `openspec.cmd instructions apply --change add-pos-peripherals-platform --json`.
- `openspec.cmd validate add-pos-peripherals-platform --type change --strict`.

Resultado:

- OpenSpec validate: PASS.
- Artifacts completos: proposal, design, specs, tasks.
- `tasks.md` mantiene Fase 12.2 documentada como parcial por bloqueo de navegador autenticado click-by-click.
- Fases 13+ quedan pendientes y no fueron ejecutadas.

## Migraciones revisadas

Archivos:

- `scripts/database/migrations/V053__products_sale_model_phase_11_1.sql`.
- `scripts/database/migrations/V054__pos_terminal_peripheral_settings_phase_12.sql`.

Validacion SQL local:

- `V053__products_sale_model_phase_11_1.sql`: registrada en `migrations_history` con `success=true`.
- `V054__pos_terminal_peripheral_settings_phase_12.sql`: registrada en `migrations_history` con `success=true`.
- `products.sale_type`: `text`, `NOT NULL`, default `'UNIT'`.
- `products.measurement_unit`: `text`, `NOT NULL`, default `'UND'`.
- Tablas presentes: `pos_terminals`, `pos_terminal_peripheral_settings`.
- Constraints presentes para PK, FK, unique terminal settings, `mode`, `code` no vacio y `name` no vacio.

Revision tecnica:

- V053 usa `ADD COLUMN IF NOT EXISTS`, `UPDATE` seguro para defaults, constraints idempotentes por `pg_constraint` e indices `IF NOT EXISTS`.
- V054 usa `CREATE TABLE IF NOT EXISTS`, indices `IF NOT EXISTS`, triggers recreados de forma controlada, `ON CONFLICT` para terminal MOCK local y no guarda secretos.
- No aplicar en PRD sin aprobacion operativa y plan de despliegue.

## API

Comandos:

- `cd api`
- `npm.cmd run build`
- `npx.cmd tsx --test "src/**/*.spec.ts"`

Resultado:

- Build API: PASS.
- Tests API: PASS.
- Total tests: 378.
- Pass: 377.
- Skipped: 1.
- Fail: 0.

Cobertura relevante observada:

- `ProductService enriched product rules`.
- `ProductBarcodeService`.
- `PosTerminalsService`.
- `MenuAdminService`.
- `UsersService`.
- RBAC/menu sin regresion detectada.

## Web

Comandos:

- `cd web`
- `npm.cmd run build`

Resultado:

- Build web: PASS.
- `npm.cmd test`: no se ejecuto porque `web/package.json` no define script `test`.
- Rutas compiladas:
  - `/[tenant]/admin/peripherals`.
  - `/[tenant]/pos`.
  - `/[tenant]/inventory/products`.
  - `/[tenant]/inventory/purchases`.
  - `/[tenant]/orders`.

Warnings documentados:

- Warnings preexistentes de `react-hooks/exhaustive-deps`.
- Warnings preexistentes de uso de `<img>`.

## backend-perifericos

Comandos:

- `cd backend-perifericos`
- `npm.cmd run build`
- `npm.cmd test`

Resultado:

- Build: PASS.
- Tests: PASS.
- Total tests: 33.
- Pass: 33.
- Fail: 0.

Smoke MOCK:

- `GET http://localhost:4050/health`: PASS, `mode=MOCK`.
- `GET http://localhost:4050/devices`: PASS, HTTP 200.
- `GET http://localhost:4050/logs`: PASS, HTTP 200.

Validado:

- MOCK adapters siguen funcionando.
- `NetworkEscposPrinterAdapter` existe, pero adapters reales quedan bloqueados por defecto.
- Tests cubren `real adapters disabled blocks NETWORK printer`.
- README actualizado con feature flag y runbook seguro.

## Fallback MOCK

Validacion por contrato frontend:

```json
{
  "source": "FALLBACK_MOCK",
  "terminalId": "local-terminal",
  "printer": "mock-printer-001",
  "drawer": "mock-cashdrawer-001",
  "scale": "mock-scale-001",
  "scanner": "mock-scanner-001"
}
```

Agent offline:

```json
{
  "success": false,
  "error": {
    "code": "AGENT_OFFLINE",
    "operation": "getPeripheralAgentHealth"
  }
}
```

## Feature flags

`web/.env.example` contiene:

- `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL=http://localhost:4050`.
- `NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL=ws://localhost:4050/peripherals`.
- `NEXT_PUBLIC_PERIPHERALS_ENABLED=true`.
- `NEXT_PUBLIC_PERIPHERALS_PRINT_SALE_ENABLED=true`.
- `NEXT_PUBLIC_PERIPHERALS_PRINT_PURCHASE_ENABLED=true`.
- `NEXT_PUBLIC_PERIPHERALS_PRINT_ORDER_ENABLED=true`.
- `NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED=true`.
- `NEXT_PUBLIC_PERIPHERALS_SCALE_ENABLED=true`.
- `NEXT_PUBLIC_PERIPHERALS_SCANNER_ENABLED=true`.

`backend-perifericos/.env.example` y README contienen:

- `PERIPHERALS_PORT=4050`.
- `PERIPHERALS_MODE=MOCK`.
- `PERIPHERALS_ENABLE_REAL_ADAPTERS=false`.
- `PERIPHERALS_ALLOWED_ORIGINS`.
- `PERIPHERALS_LOG_LIMIT=500`.
- `PERIPHERALS_PRINTER_WIDTH_CHARS=48`.

No se activo `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.

## Evidencias QA revisadas

Existen evidencias para:

- backend-perifericos hardening.
- web perifericos mock.
- menu/RBAC.
- seed/menu/RBAC.
- ESC/POS MOCK.
- preview web.
- profiles/adapters.
- network feature flag.
- network UI flag disabled.
- contracts.
- ventas.
- compras.
- pedidos.
- scanner y catalogo con codigos de barras.
- balanza.
- productos pesables.
- formulario productos pesables.
- terminal config.
- QA operativo integral.
- QA manual autenticado parcial.
- pre-merge stabilization.

## Secretos

Se ejecuto busqueda en `docs/evidencia-qa*.md` para patrones de token/password/JWT/PGPASSWORD.

Resultado:

- No se detectaron tokens reales ni credenciales en evidencias QA.
- `.env.example` revisados contienen placeholders o valores locales no sensibles.
- Los documentos generales del repo tienen ejemplos/placeholder historicos, no introducidos por esta fase.

## Documentacion revisada

- `backend-perifericos/README.md`: actualizado.
- `web/domains/peripherals/README.md`: actualizado.
- Evidencias QA: creadas hasta Fase 12.3.
- `tasks.md`: refleja Fase 12.2 parcial y Fase 12.3 pre-merge.

## Riesgos pendientes

- Smoke visual autenticado click-by-click no completado por limitacion del Browser tool en Fase 12.2.
- Hardware real no probado.
- Electron no implementado.
- Capacitor no implementado.
- NETWORK real preparado, pero desactivado por defecto.
- Migraciones V053/V054 deben aplicarse en cada ambiente antes del despliegue.
- CRLF/LF warnings de Git siguen presentes; no bloquean `git diff --check`.

## Recomendacion

Resultado: `MERGE_READY`.

Motivo:

- API build/test pasa.
- Web build pasa.
- backend-perifericos build/test pasa.
- OpenSpec validate pasa.
- `git diff --check` pasa.
- Migraciones revisadas.
- Feature flags revisadas.
- Fallback MOCK revisado.
- Evidencia pre-merge creada.
- No hay hardware real ni drivers.

Condicion operativa para el PR:

- En la descripcion del PR/MR, declarar que la validacion visual autenticada click-by-click queda como riesgo pendiente documentado y debe ejecutarse antes de despliegue productivo.

## Restricciones cumplidas

- No se implementaron funcionalidades nuevas.
- No se activo `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No se uso USB, serialport ni HID.
- No se instalaron drivers.
- No se conecto hardware real.
- No se integro Electron.
- No se integro Capacitor.
- No se modifico `backend-reporteria/`.
- No se hicieron cambios fiscales nuevos.
- No se hizo commit.
- No se hizo merge.
- No se avanzo a Fase 13.
