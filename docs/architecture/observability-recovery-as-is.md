# Observabilidad y recuperación AS-IS

## Señales disponibles

| Señal | Evidencia | Cobertura | Limitación |
|---|---|---|---|
| Health API | `GET /api/system/version` | Disponibilidad básica | No es readiness de PostgreSQL |
| Health reportería | `GET /api/reports/health` | Disponibilidad básica | No certifica consultas ni permisos |
| Health fiscal | `GET /health` | Devuelve estado, servicio, timestamp y ambiente | No prueba proveedor fiscal |
| Logs PM2 | `out_file`/`error_file` por proceso QA | QA declarado | No se verificó agregación ni retención |
| Logs de errores | `console.error`, `Logger`, errores de pool y workers | API, reportería y fiscal | No hay métrica central demostrada |
| Correlación fiscal | `eventId`, `correlationId`, `source.id`, `tenantId` | Outbox/inbox | No se encontró tracing distribuido |
| Estado Outbox | `PENDING`, `PROCESSING`, `PUBLISHED`, `FAILED` | Dispatcher | No hay dashboard o alerta versionada |
| Estado fiscal | Documento y `processing_stage` | Worker fiscal | Requiere leer PostgreSQL o API interna |

El `DatabaseService` fiscal registra errores del pool y cierra el pool en shutdown; reportería libera clientes pero no muestra un health check de conexión en el controlador revisado ([fiscal](../../backend-facturacion-electronica/src/modules/database/database.service.ts#L51-L128), [reportería](../../backend-reporteria/src/modules/database/database.service.ts#L29-L43)).

## Recuperación implementada

- **Outbox:** claim con lease, concurrencia limitada, backoff, máximo de intentos y fallo terminal. `ALREADY_PROCESSED` se trata como entrega completada.
- **Lease expirado:** el mecanismo de claim vuelve a considerar eventos vencidos; la verificación en ambiente queda pendiente.
- **Backend fiscal caído:** la excepción se clasifica como retryable y el evento queda para otro intento, sujeto a configuración.
- **Inbox duplicado:** el consumidor busca por evento y por fuente antes de crear documento; el inbox usa transacción.
- **Worker fiscal:** procesa documentos `PENDING`, refresca `PROCESSING`, reintenta `TECHNICAL_ERROR` y difiere casos agotados a revisión manual ([fuente](../../backend-facturacion-electronica/src/modules/electronic-billing/workers/electronic-billing-background.service.ts#L107-L159), [fuente](../../backend-facturacion-electronica/src/modules/electronic-billing/workers/electronic-billing-background.service.ts#L254-L312)).
- **Despliegue QA:** respalda binarios antes de reemplazarlos y verifica PID/smoke HTTP.
- **Despliegue producción:** conserva snapshots, reinicia PM2 y restaura archivos si fallan los health checks.
- **PostgreSQL:** `backup.sh` usa `pg_dump --format=custom`; `rollback.sh` usa `pg_restore --clean --if-exists` ([fuente](../../scripts/database/backup.sh#L15-L40), [fuente](../../scripts/database/rollback.sh#L23-L46)). No se ejecutaron.

## Límites

No se demuestra entrega exactly-once, recuperación automática de datos, restauración de base validada, alertamiento, RPO/RTO, replicación PostgreSQL, failover, circuit breaker ni continuidad ante caída simultánea de API y fiscal.

La atomicidad documentada en B2.3 permanece limitada al flujo de creación automática de venta que comparte `PoolClient`; no se generaliza a despliegues, backups ni procesos externos.
