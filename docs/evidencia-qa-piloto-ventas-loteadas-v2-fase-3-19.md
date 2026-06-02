# Evidencia Fase 3.19 - Piloto QA ventas loteadas v2

Fecha/hora: 2026-05-28 12:33:06 -05:00

Decision final: **QA PILOTO BLOQUEADO**

## Resumen

Se intento iniciar la ejecucion del piloto QA controlado siguiendo `docs/runbook-qa-piloto-ventas-loteadas-v2-fase-3-18.md`, pero se detuvo antes de tocar QA porque no existe configuracion verificable de ambiente QA en el workspace.

No se ejecuto ningun comando contra QA ni PRD.

## Ambiente QA confirmado

No confirmado.

Revision sanitizada de configuracion disponible:

| Archivo | Resultado |
| --- | --- |
| `scripts/config/db.env` | `ENVIRONMENT=dev`, `DB_HOST=localhost`, `DB_NAME=manus_tienda_prd`, `SSH_HOST=example.com`. |
| `api/.env` | `NODE_ENV=development`, `DB_HOST=localhost`, `DB_DATABASE=manus_tienda_prd`, `PORT=4020`. |
| `backend-reporteria/.env` | `DB_HOST=localhost`, `DB_NAME=manus_tienda_prd`. |
| `web/.env` | Apunta a `localhost`. |

SUPUESTO: el nombre local `manus_tienda_prd` no representa PRD remoto; en fases previas se valido como base local/dev por `localhost`.

## Confirmacion NO PRD

PRD no fue tocado.

No se encontro una configuracion QA distinta de local/dev. Por seguridad, no se uso `localhost` como sustituto de QA.

## Backup QA

No realizado.

Motivo: falta host/base QA confirmados y mecanismo de backup QA autorizado.

## PostgreSQL version

No validada en QA.

Motivo: no hay conexion QA confirmada.

## Migraciones

No se validaron ni aplicaron en QA:

- `scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql`
- `scripts/database/migrations/20260602_inventory_create_sale_v2.sql`

Motivo: no hay conexion QA confirmada.

## Config tenant/sucursal

No aplicada.

Faltan datos obligatorios:

| Dato | Estado |
| --- | --- |
| `<TENANT_ID_QA>` | No definido en contexto. |
| `<BRANCH_ID_QA>` | No definido en contexto. |
| `<BRANCH_ID_CONTROL_QA>` | No definido en contexto. |
| Usuario QA de prueba | No definido en contexto. |
| API QA base URL | No definida en contexto. |
| Metodo de backup QA | No definido en contexto. |
| Procedimiento de reinicio API QA | No definido en contexto. |

## Estado env flag

No se modifico ningun `.env` real.

No se activo `INVENTORY_SALE_V2_ENABLED` en QA.

## Healthcheck API QA

No ejecutado.

Motivo: API QA no identificada.

## Resultado pruebas A-M

| Caso | Estado | Motivo |
| --- | --- | --- |
| A. Venta no loteada | No ejecutada | QA no confirmado. |
| B. Recepcion compra con lote | No ejecutada | QA no confirmado. |
| C. Venta loteada con un lote suficiente | No ejecutada | QA no confirmado. |
| D. Venta loteada con varios lotes FEFO | No ejecutada | QA no confirmado. |
| E. Venta mixta loteado/no loteado | No ejecutada | QA no confirmado. |
| F. Stock insuficiente loteado | No ejecutada | QA no confirmado. |
| G. Lote vencido no se vende | No ejecutada | QA no confirmado. |
| H. Lote `BLOCKED`/`CANCELLED` no se vende | No ejecutada | QA no confirmado. |
| I. Cancelacion venta loteada | No ejecutada | QA no confirmado. |
| J. Cancelacion venta mixta | No ejecutada | QA no confirmado. |
| K. Sucursal no habilitada usa v1 | No ejecutada | QA no confirmado. |
| L. Reconciliacion `critical=0`, `high=0` | No ejecutada | QA no confirmado. |
| M. Ticket/venta sin romper contrato | No ejecutada | QA no confirmado. |

## IDs sanitizados

No aplica. No se crearon ventas/lotes en QA.

## Queries/curls sanitizados

No se ejecutaron queries ni curls contra QA.

Plantilla pendiente para cuando existan datos QA:

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "<QA_API_BASE_URL>/api/inventory/lot-reconciliation/summary?branchId=<BRANCH_ID_QA>"
```

## Resultado reconciliacion

No ejecutada.

## Rollback

No ejecutado porque no se aplico ningun cambio QA.

Rollback rapido sigue pendiente de confirmar:

1. `tenants.config.inventory.saleV2Enabled=false`.
2. `tenants.config.inventory.saleV2Branches=[]`.
3. `INVENTORY_SALE_V2_ENABLED=false`.
4. Reinicio API QA.
5. Validacion v1.

## Comandos ejecutados

Solo comandos locales de inspeccion sin secretos:

```bash
Get-Content docs/runbook-qa-piloto-ventas-loteadas-v2-fase-3-18.md
Get-Content openspec/changes/fortalecer-productos-inventario/tasks.md
rg --files
rg -n "QA|qa|staging|PRD|prd|INVENTORY_SALE_V2_ENABLED|saleV2" ...
```

No se imprimieron passwords, tokens, JWT ni secretos.

## Riesgos vivos

- RIESGO: no hay conexion QA identificada en el workspace.
- RIESGO: no hay tenant/sucursal piloto QA definidos.
- RIESGO: no hay procedimiento de backup QA confirmado.
- RIESGO: no hay procedimiento de reinicio API QA confirmado.
- RIESGO: `api/.env` local tiene `INVENTORY_SALE_V2_ENABLED` configurado, pero esto no confirma estado QA.

## Datos requeridos para continuar

Para ejecutar Fase 3.19, se necesita:

1. Host/base QA confirmados y forma de conexion sin exponer secreto.
2. Confirmacion explicita de que no es PRD.
3. Comando/procedimiento de backup QA.
4. API QA base URL.
5. Procedimiento de reinicio API QA.
6. `<TENANT_ID_QA>`.
7. `<BRANCH_ID_QA>`.
8. `<BRANCH_ID_CONTROL_QA>`.
9. Usuario QA con permisos POS/inventario/compras/caja.
10. Producto no loteado de control.
11. Producto loteado de control.
12. Metodo de pago/caja de prueba.

## Proximo paso

Reintentar Fase 3.19 cuando los datos QA y el backup esten confirmados.
