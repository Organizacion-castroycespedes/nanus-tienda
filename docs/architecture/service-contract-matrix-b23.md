# Matriz de contratos B2.3

| Relación | Contrato | Evidencia | Estado | Pendiente |
|---|---|---|---|---|
| API → Integration Outbox | `enqueueSaleCompletedEvent(input, PoolClient?)` | `api/src/modules/integration-outbox/services/integration-outbox.service.ts:21-39` | Implementado | Inventario de todos los productores |
| API → Facturación | `POST /internal/electronic-billing/events/sale-completed`, Bearer interno, envelope v1 | `api/src/modules/integration-outbox/services/billing-integration-client.ts:20-22`; `backend-facturacion-electronica/src/modules/electronic-billing/consumers/electronic-billing-sale-event.controller.ts:86-110` | Implementado en código; despliegue no verificado | URL, token y conectividad por ambiente |
| Facturación inbox | Deduplicación por `eventId` y por `(tenantId, sourceType, sourceId)`; hash estable | `backend-facturacion-electronica/src/modules/electronic-billing/consumers/electronic-billing-sale-event.consumer.ts:112-151` | Implementado | Confirmar constraints en cada ambiente |
| Facturación → proveedor | Interfaz `ElectronicBillingProvider`, resolver y fake/FactuCore/DIAN_DIRECT | `backend-facturacion-electronica/src/modules/electronic-billing/providers/`; `providers/fake-electronic-billing-provider.ts:128-221` | Preparado; fake verificable | Prueba controlada con proveedor autorizado |
| Facturación → DIAN | SOAP/XML y configuración DIAN_DIRECT | `backend-facturacion-electronica/src/modules/providers/dian/`; `test/dian-direct-provider.spec.ts` | Fixtures/mock local | Transmisión real y aceptación |
| Reportería → PostgreSQL | SQL directo con filtros tenant/sucursal; exportación read-only | `backend-reporteria/src/modules/reports/sql-adapters/`; `document-export.service.ts:43-72` | Implementado | Validar esquema QA |
| API → Reportería | No se encontró cliente HTTP en módulos revisados | `backend-reporteria/src/app.module.ts:1-10` y módulo de reportes | No verificado como integración HTTP | Revisar consumidores frontend/infra |

## Errores y respuestas

La API de outbox clasifica respuestas HTTP y excepciones en retryable/non-retryable. El receptor devuelve resultados de consumo y fallas temporales. Las acciones documentales devuelven estados seguros y mensajes sanitizados. No se documentan payloads fiscales reales.
