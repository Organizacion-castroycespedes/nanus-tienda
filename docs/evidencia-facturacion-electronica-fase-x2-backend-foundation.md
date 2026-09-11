# Evidencia FASE X2 - Backend Foundation y Extraccion Arquitectonica

## Change OpenSpec

- `extraer-bounded-context-facturacion-electronica-a-backend-dedicado`

## Discovery de backend facturacion electronica

- Es una app NestJS real.
- Tiene `package.json`.
- Tiene `src/main.ts`.
- Tiene `AppModule`.
- Tiene `GET /health`.
- Tiene tests en `test/**/*.spec.ts`.
- No tenia DB layer propio.
- No tenia migrations.
- No tenia `pg` instalado antes de esta fase.
- Comparte OpenSpec del root.

## Foundation DB preparada

- Se agrego `pg` al backend.
- Se agrego `@types/pg` para build TypeScript.
- Se creo `src/config/database.config.ts`.
- Se creo `src/modules/database/database.service.ts`.
- Se creo `src/modules/database/database.module.ts`.
- Se agrego shutdown lifecycle con `app.enableShutdownHooks()`.
- La conexion usa envs `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `DB_SSL`, `DB_LOGGING`, `DB_POOL_MAX`.
- El `DatabaseService` soporta `query()`, `getClient()`, `transaction()`, `close()`.
- El pool se cierra en shutdown.

## Module shell

- Se creo `src/modules/electronic-billing/electronic-billing.module.ts`.
- Es solo shell.
- No mueve dominio.

## Ownership y boundary

- API sigue dueña del flujo de venta.
- Billing backend es candidato para el bounded context electronico.
- API no debe leer `electronic_*` para construir factura despues del cutover.
- `SaleCompletedForElectronicBilling` queda como contrato de integracion futuro.

## Estado

- No se movio codigo productivo de billing.
- No se implemento outbox.
- No se implemento credentials.
- No se toco FactuCore.
- No se toco QA ni PROD.

## Validacion

- `backend-facturacion-electronica`:
  - `npm run build` PASS
  - `npm test` PASS

