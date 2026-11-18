## 1. Implementacion

- [x] 1.1 Rama de anulacion para ventas de pedido sin salidas propias.
- [x] 1.2 Devolucion de lotes de la entrega descontando lo ya devuelto.
- [x] 1.3 V119 + rollback + pruebas (estaticas y funcionales en PostgreSQL 16).
- [x] 1.4 Series del pedido en la anulacion.
- [x] 1.5 Reembolso en caja de los pagos del pedido y estado REFUNDED.
- [x] 1.6 Pruebas API (`operational-sales.order-void.spec.ts`), incluido que el POS no cambia.

## 2. Validacion

- [x] 2.1 `openspec.cmd validate corregir-anulacion-ventas-pedido --strict`.
- [x] 2.2 Aplicar V119 en local; suite API + build.
- [x] 2.3 QA: anular venta de pedido (con y sin devolver inventario), venta de pedido con lote y venta del POS; verificar pago REFUND, movimiento de caja y estado Devuelta.
- [ ] 2.4 Ajustes manuales de inventario por las anulaciones previas (SETP990900026 y SETP990900028).
