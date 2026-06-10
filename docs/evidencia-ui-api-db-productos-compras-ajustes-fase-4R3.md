# Evidencia UI/API/DB productos, compras y ajustes - Fase 4.R3

## Resumen ejecutivo

Fase 4.R3 ejecutada sobre QA local, que en este proyecto corresponde a copia local de PRD.

- DB host: `localhost`
- DB name: `manus_tienda_prd`
- PostgreSQL: `16.12`
- Web local: `http://localhost:3000`
- API usada por web: `http://localhost:4020/api`
- PRD real: no tocado
- Servidor remoto: no tocado

Resultado final: **FASE 4.R3 COMPLETA**.

## Respaldo y fixture

Backup local previo:

```powershell
C:\Users\Profe\AppData\Local\Temp\manus_tienda_prd_4r3_ui_20260528_200652.dump
```

Fixture local aplicado:

```powershell
psql -h localhost -p 5432 -U postgres -d manus_tienda_prd -f scripts/database/dev/20260528_fixture_ui_4r3_local.sql
```

Cleanup ejecutado:

```text
fixture_rows_remaining = 0
```

## IDs y datos usados

- Tenant: `00000000-0000-0000-0000-000000000001`
- Sucursal piloto: `ab41d3da-6686-4de3-9191-875a5a7da5a5`
- Producto loteado fixture: `93000000-0000-0000-0000-000000000101`, SKU `S4R3-LOT-FIXTURE`
- Producto no loteado fixture: `93000000-0000-0000-0000-000000000102`, SKU `S4R3-NOLOT-FIXTURE`
- Compra loteada: `93000000-0000-0000-0000-000000000201`
- Compra no loteada: `93000000-0000-0000-0000-000000000203`
- Ubicacion: `93000000-0000-0000-0000-000000000008`, code `S4R3-A1`
- Producto enriquecido creado por UI: `7e5886af-c72c-4721-90cc-82db4173f8d8`, SKU `S4R3-UI-ENR-1780017609296`
- Producto no loteado creado por UI: `3e2958f4-c979-43e8-84ba-8692ee3dacc6`, SKU `S4R3-UI-NOLOT-1780018479781`
- Lote recibido por compra UI: `S4R3-REC-1780017928385`
- Lote creado por ajuste IN UI: `S4R3-ADJ-IN-1780018116511`

## Flujo A - producto enriquecido desde UI

Crear producto desde UI paso:

- `isPerishable=true`
- `requiresLot=true`
- `requiresExpiration=true`
- `operationalStatus=ACTIVE`
- `rotationClass=HIGH`
- `minStock=5`
- `maxStock=20`

Editar producto desde UI paso:

- `requiresExpiration=false`
- `rotationClass=LOW`
- `minStock=3`
- `maxStock=15`

Validacion DB:

```text
S4R3-UI-ENR-1780017609296|t|t|f|ACTIVE|LOW|3.00|15.00|90.00
```

Validacion API `GET /api/products/:id`:

```json
{
  "sku": "S4R3-UI-ENR-1780017609296",
  "isPerishable": true,
  "requiresLot": true,
  "requiresExpiration": false,
  "operationalStatus": "ACTIVE",
  "rotationClass": "LOW",
  "minStock": 3,
  "maxStock": 15
}
```

Validacion API `GET /api/inventory/products`:

```json
{
  "found": true,
  "sku": "S4R3-UI-ENR-1780017609296",
  "isPerishable": true,
  "requiresLot": true,
  "requiresExpiration": false,
  "operationalStatus": "ACTIVE",
  "rotationClass": "LOW",
  "minStock": 3,
  "maxStock": 15
}
```

Validacion UI:

- Listado mostro badges `Lote`, `Perecedero`, `Baja`.
- Badge `Vence` desaparecio tras editar `requiresExpiration=false`.

## Flujo B - recepcion de compra loteada desde UI

Recepcion loteada:

- La UI mostro badges `Perecedero`, `Requiere lote`, `Requiere vencimiento`.
- La UI mostro campos `Lote`, `Fecha de vencimiento`, `Ubicacion`, `Costo unitario`.
- Sin `lotCode`, la UI bloqueo por campo requerido.
- Sin `expirationDate`, la UI bloqueo con mensaje funcional.
- Con datos validos, se registro recepcion parcial.

Validacion DB:

```text
PARTIAL|2.00
1819feff-5dd0-410b-afd9-a2d7a965eeda|S4R3-REC-1780017928385|2026-12-31|72.00|2.00|2.00|93000000-0000-0000-0000-000000000008
97d3a27d-a10b-47c7-9df2-e550c3d573bf|IN|2.00|2.00|1819feff-5dd0-410b-afd9-a2d7a965eeda
```

Vista `/inventory/lots`:

- Busqueda `S4R3-REC-1780017928385` mostro saldo.
- En mano: `1`
- Reservado: `0`
- Disponible: `1`
- Ubicacion: `S4R3-A1 - Ubicacion prueba UI 4R3`

Recepcion no loteada:

- La UI no mostro campos de lote/vencimiento/ubicacion.
- La recepcion parcial funciono como antes.
- No se creo `stock_movement_lots`.

Validacion DB:

```text
PARTIAL|1.00
d68742e9-aaf3-42ad-bba3-4b83b5e88a87|IN|1.00|0
```

## Flujo C - ajustes loteados desde UI

Ajuste IN loteado:

- Lote: `S4R3-ADJ-IN-1780018116511`
- Cantidad: `3`
- Vencimiento: `2027-01-31`
- Ubicacion: `S4R3-A1`
- Resultado UI: `Stock ajustado correctamente.`

Ajuste OUT loteado:

- La UI cargo lotes disponibles.
- Se selecciono lote `S4R3-REC-1780017928385`.
- Cantidad salida: `1`
- Resultado UI: `Stock ajustado correctamente.`

Validacion DB:

```text
S4R3-ADJ-IN-1780018116511|3.00|3.00|93000000-0000-0000-0000-000000000008
S4R3-REC-1780017928385|1.00|1.00|93000000-0000-0000-0000-000000000008
IN|2.00|PURCHASE|2.00|S4R3-REC-1780017928385
IN|3.00|ADJUSTMENT|3.00|S4R3-ADJ-IN-1780018116511
OUT|1.00|ADJUSTMENT|1.00|S4R3-REC-1780017928385
```

Reconciliacion para producto fixture loteado:

```text
critical=0
high=0
discrepancies=0
```

## Flujo D - producto, compra y ajuste no loteado

Producto no loteado creado y editado desde UI:

```text
S4R3-UI-NOLOT-1780018479781|f|f|f|ACTIVE|LOW|2.00|12.00|36.00
```

Ajuste no loteado:

- La UI no mostro `Datos de lote`.
- Ajuste IN cantidad `2` paso.
- No se creo `stock_movement_lots`.

Validacion DB:

```text
93000000-0000-0000-0000-000000000102|IN|1.00|PURCHASE
93000000-0000-0000-0000-000000000102|IN|2.00|ADJUSTMENT
stock_movement_lots = 0
```

## Bug encontrado y corregido

Bug:

- Ajuste OUT loteado enviaba `expirationDate` como ISO datetime desde el lote seleccionado.
- Backend esperaba `YYYY-MM-DD`.
- Error observado: `expirationDate must use YYYY-MM-DD`.

Correccion minima:

- Archivo: `web/modules/inventory/components/StockAdjustmentForm.tsx`
- Se agrego `toDateInputValue`.
- Ajuste OUT ahora envia `expirationDate` como `YYYY-MM-DD`.
- La UI tambien muestra fechas de lote en formato corto.

No se modifico backend.

## Comandos ejecutados

```powershell
pg_dump -h localhost -p 5432 -U postgres -d manus_tienda_prd -Fc -f C:\Users\Profe\AppData\Local\Temp\manus_tienda_prd_4r3_ui_20260528_200652.dump
psql -h localhost -p 5432 -U postgres -d manus_tienda_prd -f scripts/database/dev/20260528_fixture_ui_4r3_local.sql
cd api; $env:PORT='4031'; npm run start:dev
cd web; npm run dev
cd web; npm run build
cd web; npx tsc --noEmit --pretty false
cd web; npm run lint
psql -h localhost -p 5432 -U postgres -d manus_tienda_prd -f scripts/database/dev/20260528_fixture_ui_4r3_local_cleanup.sql
```

Nota: un primer `npx tsc --noEmit --pretty false` se lanzo en paralelo con `next build`; fallo por `.next/types` temporal mientras `next build` regeneraba tipos. Se repitio despues del build y paso.

## Resultado de validaciones

- `cd web && npm run build`: paso.
- `cd web && npx tsc --noEmit --pretty false`: paso al repetir despues de build.
- `cd web && npm run lint`: bloqueado por prompt interactivo de `next lint` para configurar ESLint.
- Pruebas UI/API/DB A-D: pasaron.
- Cleanup local: paso con `fixture_rows_remaining=0`.

## Confirmaciones de alcance

- No se toco PRD real.
- No se toco servidor remoto.
- No se toco `backend-reporteria/`.
- No se modifico `inventory_create_sale`.
- No se modifico `inventory_create_sale_v2`.
- No se modifico POS UI.
- No se agregaron pantallas nuevas.
- No se agregaron tablas ni migraciones.

## Riesgos vivos

- `next lint` sigue requiriendo configuracion interactiva del proyecto.
- La reconciliacion global de la sucursal muestra discrepancias altas legacy, pero el producto/lote fixture validado queda `critical=0 high=0`.
- Los datos de prueba fueron limpiados; repetir la prueba requiere reaplicar fixture.

## Decision final

**FASE 4.R3 COMPLETA**.
