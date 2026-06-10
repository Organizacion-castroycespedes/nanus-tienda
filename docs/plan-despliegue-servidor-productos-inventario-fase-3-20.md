# Plan de despliegue servidor productos e inventario - Fase 3.20

## 1. Alcance del despliegue

Este plan prepara el despliegue futuro al servidor/PRD real del cambio `fortalecer-productos-inventario`.

Incluye:

- Migracion de estructura para productos enriquecidos, barcodes, ubicaciones, lotes, balances, movement lots, historial de precios y alertas.
- Funcion SQL nueva `inventory_create_sale_v2`.
- Backend `api/` con soporte de productos enriquecidos, lotes, compras, ajustes, reconciliacion, FEFO selector, cancelacion loteada y activacion v2 por tenant/sucursal.
- Documentacion y evidencia para operacion.

No incluye:

- Activacion masiva de v2.
- Cambios en `web/`.
- Cambios en `backend-reporteria/`.
- Cambios en POS UI.
- Ejecucion de fixtures locales.

## 2. Archivos que deben desplegarse

| Archivo/directorio | Uso |
| --- | --- |
| `api/` | Backend principal con cambios de inventario, ventas v2 por flag y cancelacion loteada. |
| `scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql` | Migracion de estructura de productos/lotes/balances/alertas/precios. |
| `scripts/database/migrations/20260601_inventory_products_lots_phase_1_rollback.sql` | Rollback disponible. No ejecutar salvo decision de contingencia. |
| `scripts/database/migrations/20260602_inventory_create_sale_v2.sql` | Crea `inventory_create_sale_v2` sin tocar v1. |
| `scripts/database/migrations/20260602_inventory_create_sale_v2_rollback.sql` | Rollback de funcion v2. |
| `docs/runbook-migracion-productos-inventario-fase-2-1.md` | Guia de migracion base. |
| `docs/runbook-qa-piloto-ventas-loteadas-v2-fase-3-18.md` | Guia de pruebas piloto. |
| `docs/consolidacion-productos-inventario-fase-3-20.md` | Estado consolidado. |
| `docs/plan-despliegue-servidor-productos-inventario-fase-3-20.md` | Este plan. |

## 3. Archivos que NO deben ejecutarse en servidor

| Patron | Motivo |
| --- | --- |
| `scripts/database/dev/*` | Fixtures locales. Pueden crear tenants, productos o ventas de prueba. |
| `scripts/database/tests/*` | Pruebas locales/SQL. No son migraciones de servidor. |
| `scripts/database/sale/drafts/*` | Disenos conceptuales. No son scripts activos. |
| Fixtures locales de Fase 3.14, 3.17 y 3.19-local | Solo sirven para local/dev/QA local. |

## 4. Precondiciones servidor

- Backup completo y restaurable de base servidor.
- Confirmar PostgreSQL 16 con `SELECT version();`.
- Confirmar base correcta antes de ejecutar cualquier SQL.
- Confirmar que no se esta conectado a una base equivocada.
- Confirmar variables env de `api`, sin imprimir secretos.
- Confirmar proceso real de API: PM2, systemd, Docker u otro.
- Confirmar Nginx/proxy si aplica.
- Confirmar healthcheck de `api`.
- Confirmar acceso a logs de `api`.
- Confirmar usuario operativo con autorizacion de despliegue.
- Confirmar ventana de mantenimiento.
- Confirmar rollback rapido:
  - `tenants.config.inventory.saleV2Enabled=false`.
  - `INVENTORY_SALE_V2_ENABLED=false`.
  - reinicio `api`.

## 5. Orden de despliegue

1. Backup.
2. Aplicar `scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql`.
3. Validar tablas nuevas y columnas nuevas.
4. Aplicar `scripts/database/migrations/20260602_inventory_create_sale_v2.sql`.
5. Validar que `inventory_create_sale` v1 sigue existiendo.
6. Validar que `inventory_create_sale_v2` existe.
7. Validar que `inventory_invoice_order` existe.
8. Desplegar `api/`.
9. Configurar `INVENTORY_SALE_V2_ENABLED=false` inicialmente.
10. Reiniciar `api`.
11. Validar healthcheck.
12. Validar que venta no loteada funciona con v1.
13. Preparar tenant/sucursal piloto si se decide activar v2.
14. Configurar `tenants.config.inventory.saleV2Enabled=true` solo para tenant piloto.
15. Configurar `saleV2Branches` solo con sucursal piloto.
16. Cambiar `INVENTORY_SALE_V2_ENABLED=true` solo cuando exista autorizacion explicita.
17. Reiniciar `api`.
18. Validar que sucursal piloto usa v2 y sucursal no habilitada usa v1.

## 6. Validaciones servidor

### Base de datos

- `inventory_create_sale` existe.
- `inventory_create_sale_v2` existe.
- `inventory_invoice_order` existe.
- `products` tiene columnas enriquecidas.
- `product_barcodes` existe.
- `inventory_locations` existe.
- `inventory_lots` existe.
- `inventory_lot_balances` existe.
- `stock_movement_lots` existe.
- `product_price_history` existe.
- `inventory_alert_rules` existe.
- `inventory_alerts` existe.

### Operacion

- Venta no loteada funciona con v1.
- Venta loteada piloto funciona con v2.
- Venta mixta piloto funciona.
- Stock insuficiente loteado falla sin datos parciales.
- Cancelacion loteada revierte al lote original.
- Sucursal no habilitada sigue por v1.
- Pagos/caja no presentan errores.
- Tickets/consulta de venta siguen sin romper contrato.
- Reconciliacion queda con `critical=0` y `high=0` para los datos piloto.

## 7. Rollback

Aplicar rollback de menor a mayor impacto.

1. Desactivar `tenants.config.inventory.saleV2Enabled=false` para tenant piloto.
2. Quitar sucursal piloto de `saleV2Branches`.
3. Configurar `INVENTORY_SALE_V2_ENABLED=false`.
4. Reiniciar `api`.
5. Validar venta no loteada con v1.
6. Si hace falta, ejecutar `scripts/database/migrations/20260602_inventory_create_sale_v2_rollback.sql`.
7. Evitar rollback destructivo de tablas de `20260601` si ya existen datos capturados.
8. Solo considerar rollback de tablas con backup, autorizacion explicita y plan de preservacion de datos.

## 8. Criterios de exito

- Backup existe y fue verificado.
- Migracion `20260601` aplicada sin errores.
- Migracion `20260602` aplicada sin errores.
- `inventory_create_sale` v1 intacta.
- `inventory_create_sale_v2` disponible.
- `inventory_invoice_order` intacta.
- `api/` desplegada y healthcheck OK.
- v1 funciona con `INVENTORY_SALE_V2_ENABLED=false`.
- v2 funciona solo para tenant/sucursal piloto cuando se autoriza.
- Reconciliacion piloto `critical=0 high=0`.
- No hay saldos negativos.
- No hay errores de pagos/caja.

## 9. Criterios de abortar

- Backup no existe o no se puede validar.
- PostgreSQL no es version 16 compatible.
- Se detecta base equivocada.
- Falla migracion de estructura.
- Falla creacion de `inventory_create_sale_v2`.
- `inventory_create_sale` v1 queda afectada.
- `inventory_invoice_order` queda afectada.
- API no inicia.
- POS/API no puede vender productos no loteados.
- Venta loteada piloto falla con errores no esperados.
- Cancelacion loteada no revierte balance.
- Reconciliacion muestra `critical` o `high` en datos piloto.
- Caja/pagos quedan inconsistentes.
- Logs muestran errores repetitivos con v2.

## 10. Checklist antes de servidor

- [ ] Confirmar autorizacion de despliegue servidor.
- [ ] Confirmar host/base servidor.
- [ ] Confirmar que se esta apuntando al servidor correcto.
- [ ] Confirmar backup y ruta de restore.
- [ ] Confirmar PostgreSQL 16.
- [ ] Confirmar variables env sin exponer secretos.
- [ ] Confirmar comando de restart `api`.
- [ ] Confirmar healthcheck.
- [ ] Confirmar tenant piloto.
- [ ] Confirmar sucursal piloto.
- [ ] Confirmar sucursal control.
- [ ] Confirmar usuario/caja/terminal/metodo de pago de prueba.
- [ ] Confirmar productos no loteado y loteado.
- [ ] Confirmar rollback rapido.
- [ ] Confirmar que `scripts/database/dev/*` no se ejecutara.
- [ ] Confirmar que `scripts/database/tests/*` no se ejecutara.
- [ ] Confirmar responsable de aprobacion.

## 11. Evidencia esperada

- Fecha/hora de despliegue.
- Ambiente servidor confirmado.
- Backup creado y validado.
- Version PostgreSQL.
- Resultado de migracion `20260601`.
- Resultado de migracion `20260602`.
- Resultado healthcheck `api`.
- Estado de `INVENTORY_SALE_V2_ENABLED`.
- Config tenant/sucursal aplicada.
- IDs sanitizados de ventas/lotes piloto.
- Resultado venta no loteada.
- Resultado venta loteada.
- Resultado venta mixta.
- Resultado cancelacion loteada.
- Resultado sucursal control v1.
- Resultado reconciliacion.
- Logs sanitizados sin tokens, passwords ni secretos.
- Resultado rollback si se ejecuto.
- Decision final: aprobado, bloqueado o revertido.

## 12. Nota final

Este documento no ejecuta despliegue. Es plan para ejecucion futura. Servidor/PRD real sigue pendiente.
