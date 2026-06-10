# Consolidacion productos e inventario - Fase 3.20

## 1. Resumen ejecutivo

El cambio `fortalecer-productos-inventario` ya cuenta con soporte backend y SQL para productos enriquecidos, lotes, ubicaciones, saldos por lote, relacion movimiento-lote, recepcion de compras con lotes, ajustes con lotes, reconciliacion, selector FEFO, venta POS loteada mediante `inventory_create_sale_v2`, cancelacion loteada y activacion controlada por tenant/sucursal.

La validacion de QA del proyecto se completo en ambiente local sobre copia de PRD (`localhost:5432`, base `manus_tienda_prd`, PostgreSQL 16.12). El servidor remoto/PRD real no fue tocado y queda pendiente para una fase posterior de despliegue controlado.

## 2. Aclaracion de ambientes

| Ambiente | Estado | Uso |
| --- | --- | --- |
| QA del proyecto | Aprobado | Ambiente local sobre copia de PRD: `DB_HOST=localhost`, `DB_NAME=manus_tienda_prd`. |
| Servidor/PRD real | Pendiente | No se ha tocado. Debe desplegarse mas adelante con backup, migraciones y activacion controlada. |
| QA remoto | No aplica por ahora | No existe ambiente remoto definido. |

IMPORTANTE: La base local se llama `manus_tienda_prd`, pero fue tratada como copia local de PRD. No equivale a PRD real.

## 3. Fases completadas

| Area | Estado | Resultado |
| --- | --- | --- |
| Producto enriquecido | Completado | `products` soporta perecedero, lote obligatorio, vencimiento obligatorio, estado operativo, rotacion, stock minimo y maximo. |
| Product barcodes | Completado | Backend soporta multiples codigos de barras por producto y tenant. |
| Inventory locations | Completado | Backend administra ubicaciones fisicas por tenant y sucursal. |
| Inventory lots | Completado | Backend administra lotes basicos sin forzar stock historico. |
| Inventory lot balances | Completado | Backend consulta y prepara metodos internos de saldos por lote/ubicacion. |
| Stock movement lots | Completado | Backend consulta y registra vinculos movimiento-lote en flujos integrados. |
| Compras con lotes | Completado | Recepcion de compras loteadas crea/reutiliza lote, incrementa balance y registra `stock_movement_lots`. |
| Ajustes con lotes | Completado | Ajustes IN/OUT loteados alimentan o descuentan balances y registran vinculos. |
| Reconciliacion | Completado | Diagnostico read-only compara `stock_movements`, `stock_movement_lots`, `inventory_lot_balances`, lotes y productos. |
| FEFO selector | Completado | Selector/previsualizacion FEFO sin mutar datos. |
| `inventory_create_sale_v2` | Completado | Funcion SQL nueva descuenta lotes FEFO de forma atomica para POS. |
| Flag interno | Completado | `INVENTORY_SALE_V2_ENABLED` mantiene v1 como default. |
| Activacion tenant/sucursal | Completado | v2 solo puede usarse con env true + `tenants.config.inventory.saleV2Enabled=true` + sucursal habilitada. |
| Cancelacion loteada | Completado | Cancelacion revierte al lote original y crea `stock_movement_lots` de reverso. |
| Pruebas API QA local | Completado | API real local sobre copia PRD valido ventas no loteadas, loteadas, mixtas, rollback, cancelacion y reconciliacion. |

## 4. Evidencias generadas

| Evidencia | Archivo |
| --- | --- |
| Diagnostico inicial | `docs/diagnostico-productos-inventario.md` |
| Modelo de datos | `docs/modelo-datos-productos-inventario-fase-2.md` |
| Migracion fase 2.1 | `docs/runbook-migracion-productos-inventario-fase-2-1.md` |
| Prueba migracion local | `docs/evidencia-prueba-migracion-productos-inventario-fase-2-2.md` |
| Producto enriquecido | `docs/evidencia-backend-producto-enriquecido-fase-3-1.md` |
| Barcodes | `docs/evidencia-backend-product-barcodes-fase-3-2.md` |
| Ubicaciones | `docs/evidencia-backend-inventory-locations-fase-3-3.md` |
| Lotes | `docs/evidencia-backend-inventory-lots-fase-3-4.md` |
| Balances/movement lots | `docs/evidencia-backend-lot-balances-movement-lots-fase-3-5.md` |
| Recepcion compras loteadas | `docs/evidencia-recepcion-compras-lotes-fase-3-6.md` |
| Ajustes loteados | `docs/evidencia-ajustes-inventario-lotes-fase-3-7.md` |
| Reconciliacion | `docs/evidencia-reconciliacion-lotes-fase-3-8.md` |
| FEFO selector | `docs/evidencia-fefo-service-preparatorio-fase-3-9.md` |
| Analisis FEFO ventas POS | `docs/analisis-integracion-fefo-ventas-pos-fase-3-10.md` |
| Diseno v2 | `docs/diseno-inventory-create-sale-v2-fase-3-11.md` |
| Migracion v2 | `docs/evidencia-inventory-create-sale-v2-fase-3-12.md` |
| Flag v2 | `docs/evidencia-flag-inventory-create-sale-v2-fase-3-13.md` |
| Pruebas SQL v2 | `docs/evidencia-pruebas-inventory-create-sale-v2-fase-3-14.md` |
| Cancelacion loteada | `docs/evidencia-cancelacion-venta-loteada-fase-3-15.md` |
| Activacion tenant/sucursal | `docs/evidencia-activacion-sale-v2-tenant-branch-fase-3-16.md` |
| API real local/dev | `docs/evidencia-api-venta-loteada-v2-fase-3-17.md` |
| Hotfix pre-QA | `docs/evidencia-hotfix-pre-qa-fase-3-17-1.md` |
| Runbook QA | `docs/runbook-qa-piloto-ventas-loteadas-v2-fase-3-18.md` |
| QA bloqueado previo | `docs/evidencia-qa-piloto-ventas-loteadas-v2-fase-3-19.md` |
| Ensayo local copia PRD | `docs/evidencia-ensayo-local-copia-prd-sale-v2-fase-3-19-local.md` |

## 5. Pruebas aprobadas

| Grupo | Resultado |
| --- | --- |
| Migraciones de estructura y rollback local | Aprobado |
| Build y tests backend por fases | Aprobado en las fases donde se modifico `api/` |
| Pruebas SQL locales de `inventory_create_sale_v2` | Aprobado |
| Pruebas de cancelacion loteada | Aprobado |
| Pruebas de activacion por tenant/sucursal | Aprobado |
| Prueba API real local/dev | Aprobado |
| QA local sobre copia PRD | Aprobado |
| Reconciliacion `critical=0 high=0` en datos piloto | Aprobado |
| `openspec validate` | Aprobado |
| `git diff --check` | Aprobado |

## 6. Estado actual de v2

`inventory_create_sale` v1 sigue siendo el default operativo.

`inventory_create_sale_v2` queda disponible, pero solo se usa cuando se cumplen ambas condiciones:

1. `INVENTORY_SALE_V2_ENABLED=true` en el proceso `api`.
2. `tenants.config.inventory.saleV2Enabled=true` y la sucursal esta habilitada en `saleV2Branches`, si existe lista.

Si falta cualquier condicion, si la config es invalida o si la sucursal no esta habilitada, el backend usa v1.

## 7. Riesgos vivos

RIESGO: Servidor/PRD real todavia no fue probado.

RIESGO: Productos legacy con `requires_lot=true` y sin balances loteados pueden fallar en venta v2. Deben prepararse balances o mantenerse por v1 hasta migracion controlada.

RIESGO: Fixtures locales bajo `scripts/database/dev/*` y pruebas bajo `scripts/database/tests/*` no deben ejecutarse en servidor.

RIESGO: Reportes/tickets aun no muestran lote; el contrato actual sigue funcionando, pero la trazabilidad de lote queda en tablas tecnicas.

RIESGO: UI `web/` todavia no gestiona visualmente todos los campos de productos, lotes, vencimientos y ubicaciones.

RIESGO: `FOR UPDATE` en FEFO puede esperar bajo concurrencia real. Se debe observar en servidor antes de activar masivamente.

## 8. Pendientes

- Despliegue controlado al servidor.
- Validacion servidor con backup y rollback listo.
- Frontend para productos, lotes, vencimientos, ubicaciones y alertas.
- Reporteria de inventario en `backend-reporteria`.
- Runbook PRD final.
- Decision de activacion piloto por tenant/sucursal en servidor.
- Monitoreo de performance y bloqueos de venta loteada.

## 9. Confirmacion de esta fase

Esta Fase 3.20 fue solo documental.

No se ejecuto SQL. No se ejecutaron comandos remotos. No se toco servidor. No se toco PRD real. No se modifico codigo funcional. No se modifico `web/`, `backend-reporteria/` ni POS UI.
