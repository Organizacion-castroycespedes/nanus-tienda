# Evidencia: ensayo local sobre copia PRD de venta loteada v2 - Fase 3.19 local

## Resumen

Se ejecuto un ensayo local controlado sobre una copia local de PRD para validar `inventory_create_sale_v2` con activacion por tenant/sucursal piloto.

Resultado final: **ENSAYO LOCAL COPIA PRD APROBADO**.

Este ensayo no corresponde a QA real. La Fase 3.19 QA sigue pendiente hasta contar con ambiente QA definido y autorizacion explicita.

## Autorizacion

Frase recibida:

```text
AUTORIZADO ENSAYO LOCAL SOBRE COPIA PRD, NO PRD REAL
```

## Ambiente usado

| Campo | Valor |
| --- | --- |
| Fecha/hora | 2026-05-28 12:53:50 -05:00 |
| Tipo de ambiente | Local |
| DB_HOST | `localhost` |
| DB_PORT | `5432` |
| DB_NAME | `manus_tienda_prd` |
| Backend API local | `http://localhost:4027/api` |
| Flag proceso local | `INVENTORY_SALE_V2_ENABLED=true` |

ACLARACION OBLIGATORIA: La base se llama `manus_tienda_prd`, pero esta en `localhost` y se trato como copia local de PRD. No se ejecuto nada contra PRD real ni QA remoto.

## Backup local

Se creo backup local antes de tocar datos.

| Campo | Valor |
| --- | --- |
| Herramienta | `pg_dump -Fc` |
| Archivo | `C:\Users\Profe\AppData\Local\Temp\manus_tienda_prd_sale_v2_local_20260528_125010.dump` |
| Tamano | `568706` bytes |
| Resultado | OK |

## Validaciones previas

| Validacion | Resultado |
| --- | --- |
| `DB_HOST=localhost` | OK |
| Server address local `::1/128` | OK |
| PostgreSQL version | `16.12` |
| `inventory_create_sale` existe | OK |
| `inventory_create_sale_v2` existe | OK |
| `inventory_invoice_order` existe | OK |
| `inventory_lots` existe | OK |
| `inventory_lot_balances` existe | OK |
| `stock_movement_lots` existe | OK |

## Tenant y sucursales piloto

| Campo | Valor |
| --- | --- |
| Tenant piloto | `91000000-0000-0000-0000-000000000001` |
| Branch piloto v2 | `91000000-0000-0000-0000-000000000002` |
| Branch control v1 | `91000000-0000-0000-0000-000000000003` |
| Config tenant | `inventory.saleV2Enabled=true` |
| Branch habilitada | `91000000-0000-0000-0000-000000000002` |

Fixture local aplicado: `scripts/database/dev/20260602_fixture_sale_v2_api_local.sql`.

Cleanup local aplicado: `scripts/database/dev/20260602_fixture_sale_v2_api_local_cleanup.sql`.

## Pruebas ejecutadas

Script API local:

```powershell
$env:API_BASE_URL='http://localhost:4027/api'
cmd /c api\node_modules\.bin\tsx.cmd --tsconfig api\tsconfig.json scripts\http\20260602_sale_v2_api_local_test.ts
```

### Resultado por escenario

| Escenario | Resultado | Evidencia |
| --- | --- | --- |
| A. Venta no loteada | OK | Venta creada sin `stock_movement_lots` |
| B. Venta loteada | OK | Venta creada con decremento de lote `10 -> 6` |
| C. Venta mixta | OK | Producto loteado crea links, producto no loteado no |
| D. Stock insuficiente rollback | OK | Rollback total validado |
| E. Cancelacion loteada | OK | Balance del lote restaurado `10` |
| F. Sucursal no habilitada usa v1 | OK | Venta creada sin `stock_movement_lots` |
| G. Reconciliacion `critical=0 high=0` | OK | `critical=0 high=0 discrepancies=0` |

El script tambien valido cancelacion mixta con balance restaurado.

### IDs generados durante prueba

Estos IDs pertenecen al fixture local y fueron eliminados por cleanup:

| Caso | ID |
| --- | --- |
| Venta no loteada | `417181a2-38a4-4dc9-b0d5-be2b202e97d3` |
| Venta loteada | `0ddaa893-f5b5-4b5c-ac6b-be1ac7207a9b` |
| Venta mixta | `9ad4977c-d972-4c82-807e-acda9b2d0aca` |
| Venta branch control v1 | `50768540-bf8e-4c3d-95a0-e64a63217247` |

## Validacion de seleccion v1/v2

Logs locales sanitizados confirmaron:

```text
Using inventory_create_sale_v2 for POS sale creation
Using inventory_create_sale for POS sale creation
```

La venta en sucursal piloto uso `inventory_create_sale_v2`. La venta en sucursal control uso `inventory_create_sale` v1.

## Cleanup

Se ejecuto cleanup del fixture local y quedo limpio:

```text
fixture_rows_remaining = 0
```

El backend local iniciado para la prueba fue detenido. El puerto `4027` quedo cerrado:

```text
port4027_open=False
```

## Confirmaciones de alcance

| Confirmacion | Resultado |
| --- | --- |
| PRD real no tocado | OK |
| QA remoto no tocado | OK |
| No se ejecutaron comandos remotos | OK |
| `web/` no tocado | OK |
| `backend-reporteria/` no tocado | OK |
| POS UI no tocado | OK |
| `inventory_create_sale` v1 no modificado | OK |
| `inventory_create_sale_v2` no modificado | OK |
| `inventory_invoice_order` no modificado | OK |
| No se expusieron secretos | OK |
| No se hizo commit | OK |

## Observaciones

- El primer intento de cleanup uso una variable `DB_USER` inexistente en `api/.env`; no ejecuto el script ni cambio datos.
- El cleanup correcto uso `DB_USERNAME` y finalizo con `fixture_rows_remaining=0`.
- El error de stock insuficiente genero log funcional esperado y fue parte del escenario de rollback.

## Riesgos vivos

- QA real sigue bloqueado hasta definir host, credenciales, tenant, sucursal, usuario, caja, terminal y responsable.
- La base local se llama `manus_tienda_prd`; toda ejecucion futura debe confirmar `DB_HOST=localhost` antes de tocar datos.
- v2 depende de balances loteados consistentes.
- Productos legacy marcados `requires_lot=true` sin balances loteados deben fallar o requerir migracion/ajuste controlado.
- Tickets/reportes todavia no muestran lote.
- `FOR UPDATE` puede esperar bajo concurrencia real.

## Proximos pasos

1. Mantener Fase 3.19 QA real como pendiente.
2. Recibir configuracion QA real y autorizacion `AUTORIZADO QA, NO PRD`.
3. Ejecutar runbook QA en ambiente QA real.
4. Usar este ensayo local solo como evidencia previa, no como sustituto de QA.
