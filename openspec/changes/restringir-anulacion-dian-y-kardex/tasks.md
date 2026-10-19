## 1. Contrato DIAN y modal

- [x] 1.1 Restringir `VoidOperationalSaleDto` y la validación de `voidSale` al código `2` sin afectar `OperationalDebitNoteDto`.
- [x] 1.2 Reducir `DIAN_DISCREPANCY_REASONS` del modal a la opción 2 y conservarla preseleccionada.
- [x] 1.3 Verificar que el payload web transmita `discrepancyResponseCode` y descripción `2` solo para factura electrónica aceptada.

## 2. Reversión Kardex

- [x] 2.1 Exponer `StockMovementService` al módulo de ventas operativas e inyectarlo en `OperationalSalesService`.
- [x] 2.2 Reemplazar el `INSERT` manual del `IN` en `applySaleVoid` por `createMovement(..., client)` y conservar el `reverseMovement.id` para lotes.
- [x] 2.3 Confirmar que la consulta de movimientos originales, tenant/sucursal, múltiples movimientos por producto y locks existentes preserven idempotencia y FEFO inverso bajo concurrencia.

## 3. Pruebas

- [x] 3.1 Actualizar pruebas backend para aceptar solo código 2 y rechazar 1, 3, 4 y 5 en anulación electrónica.
- [ ] 3.2 Agregar pruebas de `stock_before`/`stock_after`, reversión no loteada, loteada, multi-tenant/sucursal, doble anulación y rollback.
- [ ] 3.3 Actualizar pruebas frontend del selector y payload, incluyendo ausencia de opciones 1, 3, 4 y 5.
- [x] 3.4 Ejecutar lint, tests y build pertinentes de `api`, `web` y contrato de facturación; registrar PASS/FAIL/BLOCKED.
- [x] 3.5 Ejecutar prueba PostgreSQL controlada en QA con fixture tenant dedicado, dos transacciones concurrentes y rollback/limpieza verificados.
- [x] 3.6 Verificar que `inventory_create_sale_v2`, `StockMovementService`, compras, ajustes, pedidos y anulaciones respeten el mismo protocolo de lock.

## 4. Revisión final

- [x] 4.1 Revisar diff y estado Git para confirmar que no se modifican `main`/`develop`, FactuCore ni migraciones ajenas a V108.
- [x] 4.2 Validar OpenSpec y documentar riesgos pendientes de concurrencia NUMERIC y aceptación DIAN real.
- [x] 4.3 Aplicar corrección de concurrencia después de confirmar V104 como fuente incremental activa; crear migración forward-only V108 y validarla temporalmente en la copia PostgreSQL local autorizada.
- [x] 4.4 Aplicar V107 y V108 en orden mediante el runner oficial con modo LOCAL estricto; verificar historial, checksums e integridad de datos.
- [x] 4.5 Asociar las rutas técnicas propias de la HU en `openspec-scope.json` sin crear cobertura múltiple.
