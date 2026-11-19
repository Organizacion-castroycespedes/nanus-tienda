## 1. API

- [x] 1.1 Restringir `updatePurchase` a `DRAFT` sin recepciones ni movimientos; quitar `status` del contrato del PUT.
- [x] 1.2 Validar total requerido con items y total no menor a lo pagado.
- [x] 1.3 Auditar `PURCHASE_DRAFT_UPDATED` en la misma transacción.
- [x] 1.4 Agregar `confirmPurchase` y `PATCH /purchases/:id/confirm` con auditoría `PURCHASE_CONFIRMED`.
- [x] 1.5 Rechazar recepción de compras `DRAFT`.
- [x] 1.6 Incluir los nuevos eventos en el historial del detalle.
- [x] 1.7 Pruebas unitarias en `purchase.service.spec.ts`.

## 2. Web

- [x] 2.1 Servicio web `updatePurchaseDraft` y `confirmPurchase`.
- [x] 2.2 `PurchaseForm` en modo edición (sucursal, terminal y fecha de solo lectura).
- [x] 2.3 Proveedor con `SearchableSelect` en crear y editar.
- [x] 2.4 Acciones Editar / Confirmar compra en menú y detalle; Recibir oculto en `DRAFT`.
- [x] 2.5 Confirmaciones con advertencia al guardar, confirmar y pagar.
- [x] 2.6 Columna "N° factura" y búsqueda por factura.
- [x] 2.7 Tabla de liquidación parcial adaptable.

## 3. Validación

- [x] 3.1 `openspec.cmd validate editar-borrador-compras --strict` en Windows.
- [x] 3.2 `npx tsx --test src/**/*.spec.ts` + `npm run build` (api) en Windows.
- [x] 3.3 `npm run lint` + `npm run build` (web) en Windows.
- [x] 3.4 QA manual: crear borrador, editar, confirmar, recibir parcial, liquidar, pagar.
