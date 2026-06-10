# Evidencia Fase 5 - validacion integral operativa

## Resumen ejecutivo

Fase 5 ejecutada en QA local sobre copia PRD. El flujo operativo producto -> compra -> recepcion loteada -> inventario por lote -> ajuste manual -> venta FEFO -> cancelacion -> reconciliacion paso completo.

Decision final: **FASE 5 APROBADA**.

No se toco PRD real. No se toco servidor remoto. No se modifico `backend-reporteria/`. No se modificaron `inventory_create_sale` v1 ni `inventory_invoice_order`.

## Ambiente usado

- DB host: `localhost`
- DB port: `5432`
- DB name: `manus_tienda_prd`
- PostgreSQL: `16.12`
- API local: `http://localhost:4027/api`
- Ambiente: QA local sobre copia PRD
- Confirmacion: la base se llama `manus_tienda_prd`, pero esta en `localhost` y fue tratada como copia local, no PRD real.

## Backup creado

Backup local antes de pruebas:

```powershell
pg_dump -h localhost -p 5432 -U <DB_USER> -Fc -f C:\Users\Profe\AppData\Local\Temp\manus_tienda_prd_phase5_operational_20260528_230250.dump manus_tienda_prd
```

Archivo:

```text
C:\Users\Profe\AppData\Local\Temp\manus_tienda_prd_phase5_operational_20260528_230250.dump
```

## Datos fixture

IDs controlados:

- tenant: `95000000-0000-0000-0000-000000000001`
- branch: `95000000-0000-0000-0000-000000000002`
- user: `95000000-0000-0000-0000-000000000005`
- location: `95000000-0000-0000-0000-000000000014`

IDs generados durante la ejecucion aprobada:

- producto loteado: `066a8596-1c7e-4c54-8e44-d001ff449716`
- producto no loteado: `98a8d85f-4380-4a6a-a26b-9f2c2f3ab34d`
- compra loteada: `bdfb62b6-61a1-4530-9c0e-885f175e6d60`
- compra no loteada: `b17fa678-bb30-40ea-94d6-f30159bb9777`
- venta loteada: `179f0b0d-8f8b-4af8-bc2a-bcfe46e0f425`
- venta mixta: `46630136-23b6-48b5-a7fb-d9f1ee32ffd6`

Codigos de lote:

- `P5-LOT-EARLY`
- `P5-LOT-LATE`

## Resultado flujo A - preparacion fixture

OK.

Se creo tenant, branch, usuario, rol `SUPER_ADMIN`, sesion auth, proveedor, cliente, metodo de pago, caja, terminal, sesion POS, ubicacion fisica y unidad.

## Resultado flujo B - producto enriquecido

OK.

Se creo producto loteado con:

- `isPerishable=true`
- `requiresLot=true`
- `requiresExpiration=true`
- `operationalStatus=ACTIVE`
- `rotationClass=HIGH`
- `minStock=5`
- `maxStock=30`

Luego se edito y se confirmo persistencia con:

- `rotationClass=LOW`
- `minStock=3`
- `maxStock=25`

Tambien se creo producto no loteado de control.

Endpoints validados:

- `GET /api/products/:id`
- `GET /api/inventory/products`

## Resultado flujo C - compra y recepcion loteada

OK.

Compra loteada recibida con `lotCode=P5-LOT-LATE`, vencimiento futuro, ubicacion y costo unitario.

Validaciones:

- UI/API funcional bloquea recepcion sin `lotCode`.
- UI/API funcional bloquea recepcion sin `expirationDate`.
- `stock_movements IN` creado.
- `inventory_lots` creado/reutilizado.
- `inventory_lot_balances` incrementado.
- `stock_movement_lots` creado.
- `/api/inventory/lots` y `/api/inventory/lot-balances` muestran saldo.

## Resultado flujo D - compra y recepcion no loteada

OK.

Compra no loteada recibida sin campos de lote.

Validaciones:

- `stock_movements IN` creado.
- `stock_movement_lots=0` para producto no loteado.
- No se crearon balances loteados para producto no loteado.

## Resultado flujo E - ajuste manual loteado

OK.

Ajuste `IN` loteado creo/reutilizo `P5-LOT-EARLY` por cantidad 4.

Ajuste `OUT` loteado desconto cantidad 1.

Balance final del lote temprano: `3`.

Validaciones:

- `stock_movements` creado.
- `stock_movement_lots` creado.
- `inventory_lot_balances` actualizado.
- Vista read-only de lote refleja cambios via API.

## Resultado flujo F - ajuste manual no loteado

OK.

Ajuste `IN` cantidad 2 y ajuste `OUT` cantidad 1 sobre producto no loteado.

Validacion:

- No se crearon `stock_movement_lots`.
- Flujo anterior sigue funcionando.

## Resultado flujo G - venta FEFO

OK.

Venta loteada con cantidad 5 consumio por FEFO:

- `P5-LOT-EARLY`: 3
- `P5-LOT-LATE`: 2

Validaciones:

- `sale` creada.
- `sale_items` creados.
- `stock_movements OUT` creados.
- `stock_movement_lots OUT` creados.
- `inventory_lot_balances` bajo correctamente.
- FEFO respeto vencimiento mas cercano primero.

Venta mixta OK:

- producto loteado creo `stock_movement_lots`.
- producto no loteado no creo `stock_movement_lots`.

## Resultado flujo H - stock insuficiente

OK.

Intento de venta loteada por cantidad 999 fallo con rollback total.

Validaciones:

- No quedo `sale` parcial.
- No quedaron `sale_items` parciales.
- No quedaron `stock_movements` parciales.
- No quedaron `stock_movement_lots` parciales.
- `inventory_lot_balances` quedo sin cambios.

## Resultado flujo I - cancelacion

OK.

Cancelacion loteada:

- Creo `stock_movements IN`.
- Creo `stock_movement_lots IN`.
- Devolvio al mismo lote original.
- Segunda cancelacion no duplico reversos.

Cancelacion mixta:

- Producto loteado revirtio al lote.
- Producto no loteado revirtio stock normal.
- No se crearon links loteados para producto no loteado.

## Resultado flujo J - reconciliacion

OK.

Reconciliacion sobre fixture:

- `critical=0`
- `high=0`
- `discrepancies=0`

Endpoints validados:

- `GET /api/inventory/lot-reconciliation/summary`
- `GET /api/inventory/lot-reconciliation/discrepancies`

## Resultado cleanup

OK.

```text
CLEANUP_OK fixture_rows_remaining=0
```

Se corrigio el orden de limpieza del fixture para respetar FK `purchase_items_product_id_fkey`.

## Bugs encontrados

1. Script de cleanup asumio que existia `purchase_status_history`.
   - Causa: esta copia local no tiene esa tabla.
   - Correccion: cleanup ahora elimina `purchase_status_history` y `product_price_history` solo si existen.

2. Script de cleanup intentaba borrar `products` antes de `purchase_items`.
   - Causa: `purchase_items.product_id` referencia `products.id`.
   - Correccion: cleanup borra `purchase_items`/`purchases` antes de `products`.

3. API local habia sido levantada sin `JWT_SECRET` explicito antes de import de modulos.
   - Causa: constantes de JWT se evaluan antes de `dotenv.config()` en bootstrap.
   - Correccion operativa de prueba: reiniciar API local con `JWT_SECRET` explicito desde `api/.env`.
   - Pendiente vivo: revisar carga temprana de env en una fase de hardening, fuera de esta fase.

## Bugs corregidos

Solo scripts locales de prueba/cleanup:

- `scripts/database/tests/20260528_phase5_operational_integral_test.ts`
- `scripts/database/dev/20260528_fixture_phase5_operational_cleanup.sql`

No se corrigio codigo funcional de `api/` ni `web/` porque el flujo funcional paso.

## Bugs pendientes

- Hardening futuro: cargar `JWT_SECRET` antes de importar modulos que lo leen como constante.
- QA visual manual con navegador completo queda recomendada antes de despliegue servidor, aunque Fase 4.R3 ya valido UI/API/DB.

## Queries de validacion

```sql
SELECT version();

SELECT
  to_regprocedure('inventory_create_sale(uuid, uuid, uuid, jsonb, jsonb, numeric, numeric, numeric, text, uuid)') IS NOT NULL AS v1_exists,
  to_regprocedure('inventory_create_sale_v2(uuid, uuid, uuid, jsonb, jsonb, numeric, numeric, numeric, text, uuid)') IS NOT NULL AS v2_exists,
  to_regprocedure('inventory_invoice_order(uuid, uuid, uuid, numeric, numeric, numeric, text, uuid)') IS NOT NULL AS invoice_exists;

SELECT COUNT(*) FROM stock_movement_lots WHERE tenant_id = '95000000-0000-0000-0000-000000000001';
SELECT COUNT(*) FROM inventory_lot_balances WHERE tenant_id = '95000000-0000-0000-0000-000000000001';
```

## Comandos ejecutados

```powershell
cd D:\Profe\manus-tienda\api
$env:PORT='4027'
$env:NODE_ENV='development'
$env:JWT_SECRET=<valor desde api/.env>
npm run start:dev
```

```powershell
cd D:\Profe\manus-tienda
$env:API_BASE_URL='http://localhost:4027/api'
$env:NODE_ENV='development'
npx tsx scripts/database/tests/20260528_phase5_operational_integral_test.ts
```

Validaciones finales:

```powershell
npx -y @fission-ai/openspec@1.3.1 validate fortalecer-productos-inventario --type change --strict --json
git diff --check
```

## Resultado build/tests

No se ejecuto build de `api/` ni `web/` porque no se modifico codigo funcional. Se ejecuto prueba integral por API real local y DB local.

## Resultado OpenSpec

OK.

```json
{
  "items": [
    {
      "id": "fortalecer-productos-inventario",
      "type": "change",
      "valid": true,
      "issues": []
    }
  ],
  "summary": {
    "totals": {
      "items": 1,
      "passed": 1,
      "failed": 0
    }
  }
}
```

Nota operativa: `openspec` no estaba disponible en PATH de esta shell. Se uso `npx -y @fission-ai/openspec@1.3.1`. El CLI aviso `EBADENGINE` por Node `18.18.2` vs requerimiento `>=20.19.0`, pero la validacion termino `valid=true`.

## Resultado git diff

OK.

`git diff --check` salio con codigo `0`. Git aviso conversion futura LF -> CRLF en `openspec/changes/fortalecer-productos-inventario/tasks.md`, sin errores de whitespace.

## Decision final

**FASE 5 APROBADA**.

Criterios cumplidos:

1. Producto enriquecido funciona.
2. Compra loteada funciona.
3. Compra no loteada funciona.
4. Ajuste loteado funciona.
5. Ajuste no loteado funciona.
6. Venta FEFO funciona.
7. Venta mixta funciona.
8. Stock insuficiente hace rollback total.
9. Cancelacion loteada funciona.
10. Reconciliacion queda `critical=0 high=0` para fixture.
11. Cleanup queda limpio.
12. No hay bloqueos funcionales abiertos.
