## 1. Contrato DIAN y modal

- [x] 1.1 Restringir `VoidOperationalSaleDto` y la validación de `voidSale` al código `2` sin afectar `OperationalDebitNoteDto`.
- [x] 1.2 Reducir `DIAN_DISCREPANCY_REASONS` del modal a la opción 2 y conservarla preseleccionada.
- [x] 1.3 Verificar que el payload web transmita `discrepancyResponseCode` y descripción `2` solo para factura electrónica aceptada.

## 2. Reversión Kardex

- [x] 2.1 Exponer `StockMovementService` al módulo de ventas operativas e inyectarlo en `OperationalSalesService`.
- [x] 2.2 Reemplazar el `INSERT` manual del `IN` en `applySaleVoid` por `createMovement(..., client)` y conservar el `reverseMovement.id` para lotes.
- [x] 2.3 Confirmar que la consulta de movimientos originales, tenant/sucursal, múltiples movimientos por producto y locks existentes preserven idempotencia y FEFO inverso.

## 3. Pruebas

- [x] 3.1 Actualizar pruebas backend para aceptar solo código 2 y rechazar 1, 3, 4 y 5 en anulación electrónica.
- [ ] 3.2 Agregar pruebas de `stock_before`/`stock_after`, reversión no loteada, loteada, multi-tenant/sucursal, doble anulación y rollback.
- [ ] 3.3 Actualizar pruebas frontend del selector y payload, incluyendo ausencia de opciones 1, 3, 4 y 5.
- [x] 3.4 Ejecutar lint, tests y build pertinentes de `api`, `web` y contrato de facturación; registrar PASS/FAIL/BLOCKED.

## 4. Revisión final

- [x] 4.1 Revisar diff y estado Git para confirmar que no se modifican `main`/`develop`, migraciones ni FactuCore.
- [x] 4.2 Validar OpenSpec y documentar riesgos pendientes de concurrencia NUMERIC y aceptación DIAN real.
