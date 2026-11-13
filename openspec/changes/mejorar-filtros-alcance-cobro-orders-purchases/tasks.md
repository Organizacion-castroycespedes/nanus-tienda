## 1. Prerrequisitos y gobernanza

- [x] 1.1 Discovery sobre `develop` `f6a91f71`: alcance por caja, filtros, facturación de pedidos, herencia de abonos en `inventory_invoice_order` (V050) y modal de "Abonar".
- [x] 1.2 Decisiones del propietario (2026-11-12): abono previo con el modal moderno; filtros ocultos por defecto con resumen y preferencia recordada; Alcance dentro de los filtros solo con caja abierta.
- [x] 1.3 Rama `feature/develop/mejorar-filtros-alcance-cobro-orders-purchases` desde `develop` `f6a91f71`.
- [x] 1.4 Registrar el change en `scripts/governance/openspec-scope.json` con la reasignación autorizada de titularidad vigente.
- [ ] 1.5 `openspec validate mejorar-filtros-alcance-cobro-orders-purchases --type change --strict` (desde la raíz del repositorio).

## 2. Filtros y alcance

- [ ] 2.1 `list-filters.ts` (conteo de filtros activos y preferencia tolerante a fallos) con pruebas.
- [ ] 2.2 `CollapsibleFilterPanel.tsx` accesible (`aria-expanded`, `aria-controls`, contenido montado y oculto).
- [ ] 2.3 `/orders`: panel colapsable, Alcance dentro de los filtros con caja abierta, sin banner.
- [ ] 2.4 `/purchases`: panel colapsable, Alcance dentro de los filtros con caja abierta, sin banner.
- [ ] 2.5 Actualizar `orders-responsive-layout.spec.ts`.

## 3. Facturar pedido

- [ ] 3.1 Ocultar "Pagos nuevos" sin saldo y retirar el formulario antiguo de pagos.
- [ ] 3.2 Botón "Registrar pago" con `DocumentPaymentForm` (`balanceDue` = saldo de la facturación) y recarga del pedido.
- [ ] 3.3 Validación CASH/CREDIT y envío de la factura sin pagos nuevos.

## 4. Verificación

- [ ] 4.1 En Windows: `cd web && npx tsx --test modules/inventory/list-filters/*.spec.ts` y `npx vitest run "app/[tenant]/orders/orders-responsive-layout.spec.ts"`.
- [ ] 4.2 `cd web && npx tsc --noEmit` y `npm run build`.
- [ ] 4.3 QA manual y evidencia en `docs/evidencia-mejorar-filtros-alcance-cobro-orders-purchases.md`.

## Matriz QA

| ID | Módulo | Caso | Resultado esperado |
|---|---|---|---|
| QA-01 | Orders, Purchases | Primera visita | Filtros ocultos, botón "Mostrar filtros" |
| QA-02 | Orders, Purchases | Mostrar, recargar la página | Filtros siguen visibles |
| QA-03 | Orders, Purchases | Aplicar 2 filtros y ocultar | Encabezado "Filtros (2)" |
| QA-04 | Orders, Purchases | Sin caja abierta | Sin banner ni selector de alcance |
| QA-05 | Orders, Purchases | Con caja abierta, Caja actual | Listado de la caja actual; alcance cuenta como filtro |
| QA-06 | Facturar | Pedido totalmente abonado | Sin "Pagos nuevos"; factura directa |
| QA-07 | Facturar | Saldo, Registrar pago total (banco o billetera) | Abono heredado, saldo 0, factura CASH OK |
| QA-08 | Facturar | Pago parcial del saldo | Saldo reducido; CASH bloqueado hasta cubrir |
| QA-09 | Facturar | CREDIT con saldo | Factura con saldo pendiente |
| QA-10 | Facturar | Cerrar el modal sin pagar | Sin pago registrado |
| QA-11 | Móvil (375 px) | Filtros y facturación | Sin desbordes |
