# Propuesta: fortalecer productos e inventario

## Problema actual

El modulo actual de productos e inventario funciona para stock basico, pero no cubre necesidades operativas de un POS con productos perecederos.

El producto actual tiene `sku`, precio, costo, unidad, impuesto y estado activo. El inventario se calcula desde `stock_movements` por producto/sucursal. Las compras reciben cantidades y generan movimientos `IN`. Las ventas POS y entregas generan movimientos `OUT`. No hay manejo de lotes, vencimientos, ubicacion fisica, rotacion formal, historial de precio ni alertas operativas persistidas.

RIESGO: La venta POS depende de funciones SQL como `inventory_create_sale`. Cualquier cambio de inventario avanzado debe mantener compatibilidad con este flujo.

## Objetivo funcional

Evolucionar productos e inventario para soportar:

- Producto enriquecido.
- Productos perecederos y no perecederos.
- Manejo de lotes.
- Vencimiento por lote.
- Ubicacion fisica del inventario.
- Clasificacion de rotacion.
- Historial de precios con motivo obligatorio.
- Alertas operativas de inventario.
- Integracion con compras, ventas, pedidos, caja y reporteria.
- Visualizacion clara en `web/`.
- Reporteria futura desde `backend-reporteria/`.

## Alcance

Incluye especificar y preparar el cambio para:

| Area | Alcance esperado |
| --- | --- |
| Productos | Campos operativos para perecedero, lote, vencimiento, barcode, estado y clasificacion. |
| Inventario | Existencias por sucursal, lote, vencimiento y ubicacion fisica. |
| Reglas de salida | FEFO para productos perecederos/loteados. |
| Compras | Captura de lote/vencimiento/ubicacion al recibir. |
| Ventas POS | Descuento compatible por FEFO sin romper el flujo del cajero. |
| Pedidos | Entregas y facturacion compatibles con lotes. |
| Precios | Precio actual e historial con motivo, usuario y vigencia. |
| Alertas | Stock bajo, agotado, proximo a vencer, vencido y baja rotacion. |
| Reporteria | Reportes de vencimientos, baja rotacion, inventario valorizado e historial de precios. |
| Web | Listados, filtros, badges, formularios y paneles claros. |

## Fuera de alcance

Esta propuesta no implementa todavia:

- Migraciones SQL.
- Endpoints nuevos.
- Cambios funcionales en `api/`.
- Cambios en `backend-reporteria/`.
- Cambios en `web/`.
- Refactor masivo de arquitectura.
- Facturacion electronica.
- Promociones.
- E-commerce.
- Sincronizacion offline.
- Integracion con impresoras.

## Impacto esperado

| Impacto | Resultado esperado |
| --- | --- |
| Operacion | Controlar inventario perecedero y evitar ventas de productos vencidos. |
| Compras | Registrar trazabilidad real desde recepcion. |
| Ventas | Descontar lotes correctos por FEFO sin friccion para POS. |
| Datos | Mantener ventas historicas y stock actual compatibles. |
| Reporteria | Habilitar reportes operativos de vencimiento, rotacion, valorizacion y precios. |
| Auditoria | Saber quien cambio precio, lote, vencimiento o ajuste. |

## Modulos afectados

| Aplicacion | Modulos |
| --- | --- |
| `api/` | `inventory`, `finance/payments`, `finance/cash-sessions`, `branches`, `tenants`, `menu`, `common/guards`, funciones SQL de ventas/pedidos. |
| `backend-reporteria/` | `reports`, `pdf`, `database/function-runner`, nuevos adapters/report services. |
| `web/` | `modules/inventory`, `modules/pos`, `modules/reporteria`, `modules/finance`, `domains/products`, rutas `inventory`, `purchases`, `pos`, `reporteria`. |
| `scripts/` | SQL de productos, ventas, reporteria y seeds de menu/permisos cuando se implemente. |
| `docs/` | Documentacion tecnica, operativa y runbook de migracion. |

## Riesgos

| Riesgo | Mitigacion |
| --- | --- |
| Romper venta POS | Implementar por fases, cubrir `inventory_create_sale` con pruebas y fallback para productos sin lote. |
| Romper compras | Hacer campos nuevos opcionales al inicio y exigirlos solo cuando producto lo configure. |
| Datos historicos sin lote | Crear estrategia de lote legacy o stock inicial sin vencimiento. |
| Reportes existentes rotos | Mantener contratos actuales y agregar campos opcionales. |
| Reglas duplicadas | Centralizar reglas transaccionales en `api/` y SQL critico usado por ventas. |
| Performance | Indexar por tenant, branch, product, expiration y lote en Fase 2. |
| UX del POS lenta | Resolver FEFO en backend; frontend solo muestra alertas utiles. |

## Dependencias

- Diagnostico tecnico en `docs/diagnostico-productos-inventario.md`.
- Scripts SQL actuales bajo `scripts/database/products`, `scripts/database/sale`, `scripts/database/finance`, `scripts/database/migrations`.
- Funciones SQL actuales de ventas y reporteria.
- RBAC por `menu_items` y `role_menu_permissions`.
- Contexto POS por `pos_user_sessions`.
- Contexto de caja por `cash_sessions`.

## Criterios generales de aceptacion

1. No se rompe el flujo actual de ventas POS.
2. No se rompe el flujo actual de compras y recepcion.
3. No se rompen reportes/tickets existentes.
4. Toda regla nueva respeta `tenant_id`.
5. Toda existencia operativa respeta sucursal.
6. Productos existentes siguen funcionando aunque no tengan lote.
7. Productos marcados como perecederos/loteados aplican reglas de lote y vencimiento.
8. Cambios de precio quedan auditados con usuario, motivo y vigencia.
9. Reporteria nueva vive en `backend-reporteria/`.
10. Frontend muestra estados, alertas y filtros sin duplicar reglas criticas.

## Estrategia incremental por fases

| Fase | Objetivo |
| --- | --- |
| Fase 0 | Diagnostico tecnico y mapa de riesgos. |
| Fase 1 | Especificacion OpenSpec y decisiones. |
| Fase 2 | Modelo de datos compatible y estrategia de migracion. |
| Fase 3 | Backend `api`: producto enriquecido, lotes, FEFO, precios, alertas. |
| Fase 4 | `backend-reporteria`: reportes y PDFs/exportables futuros. |
| Fase 5 | Frontend `web`: formularios, listados, badges y filtros. |
| Fase 6 | Integracion compras/ventas/pedidos/caja. |
| Fase 7 | Pruebas y validacion end-to-end. |
| Fase 8 | Documentacion, runbook y cierre. |

## Supuestos

SUPUESTO: Los productos actuales deben seguir operando sin lote durante una fase de transicion.

SUPUESTO: FEFO debe resolverse en backend para no exigir al cajero elegir lotes manualmente.

SUPUESTO: Los reportes nuevos usaran el patron actual de funciones SQL + adapter + service + template PDF.

## Preguntas abiertas

PREGUNTA ABIERTA: Cual sera la ventana predeterminada de "proximo a vencer"?

PREGUNTA ABIERTA: Que criterio de costo usara inventario valorizado: ultimo costo, promedio, lote o FEFO?

PREGUNTA ABIERTA: El barcode debe ser unico por tenant o por producto/unidad de venta?

PREGUNTA ABIERTA: Se requiere aprobacion para cambio de precio o basta motivo obligatorio?

