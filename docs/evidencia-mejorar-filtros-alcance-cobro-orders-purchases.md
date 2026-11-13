# Evidencia — Filtros colapsables, alcance por caja y cobro al facturar pedidos

Estado: implementación completa, verificada en Windows y **QA manual PASS** (propietario, 2026-11-12). Pendiente: PR y despliegue.

Change OpenSpec: `openspec/changes/mejorar-filtros-alcance-cobro-orders-purchases/`.

## Base y commits

- Rama: `feature/develop/mejorar-filtros-alcance-cobro-orders-purchases` desde `develop` `f6a91f71`.
- `a42503b2` change OpenSpec y scope manifest.
- `41a3bac0` filtros colapsables y alcance por caja (`web/modules/inventory/list-filters/`, páginas de pedidos y compras).
- Facturación de pedidos con el modal moderno de cobro (`OrderInvoiceForm.tsx`).

Sin cambios en API, base de datos, POS, Electron ni agente de periféricos.

## Pruebas automáticas

| Prueba | Resultado |
|---|---|
| `openspec validate mejorar-filtros-alcance-cobro-orders-purchases --type change --strict` (Windows) | Válido |
| `npx tsx --test modules/inventory/list-filters/*.spec.ts` (Windows) | 5/5 OK |
| `npx vitest run orders-responsive-layout.spec.ts` (Windows) | 6/6 OK |
| `npm run build` (Windows) | OK |
| `tsc --noEmit` (web) | Sin errores nuevos; 26 preexistentes en specs ajenos |
| ESLint sobre los archivos del change | Sin hallazgos |

## QA manual

Resultado global: **PASS** (propietario, 2026-11-12).

| ID | Módulo | Caso | Esperado | Resultado |
|---|---|---|---|---|
| QA-01 | Orders, Purchases | Primera visita | Filtros ocultos, botón "Mostrar filtros" | PASS |
| QA-02 | Orders, Purchases | Mostrar y recargar la página | Filtros siguen visibles | PASS |
| QA-03 | Orders, Purchases | Aplicar 2 filtros y ocultar | Encabezado "Filtros (2)" | PASS |
| QA-04 | Orders, Purchases | Sin caja abierta | Sin banner ni selector de alcance | PASS |
| QA-05 | Orders, Purchases | Con caja abierta, Caja actual + Buscar | Listado de la caja actual; alcance cuenta como filtro; Limpiar vuelve a Todas | PASS |
| QA-06 | Facturar | Pedido totalmente abonado | Sin "Pagos nuevos"; factura directa | PASS |
| QA-07 | Facturar | Saldo, Registrar pago total (banco o billetera) | Abono heredado, saldo 0, factura CASH OK | PASS |
| QA-08 | Facturar | Pago parcial del saldo | Saldo reducido; CASH bloqueado hasta cubrir | PASS |
| QA-09 | Facturar | CREDIT con saldo | Factura con saldo pendiente | PASS |
| QA-10 | Facturar | Cerrar el modal sin pagar | Sin pago registrado | PASS |
| QA-11 | Móvil (375 px) | Filtros y facturación | Sin desbordes | PASS |

## Notas

- El cobro al facturar se registra como abono del pedido (`createDocumentPayment`, `SALES_ORDER`) y la función `inventory_invoice_order` lo hereda; la factura se envía sin pagos nuevos.
- Si se registra el pago y no se factura, el pago queda como abono del pedido (mismo efecto que "Abonar").
- El alcance se aplica con "Buscar" o "Actualizar", igual que antes y que los demás filtros.
