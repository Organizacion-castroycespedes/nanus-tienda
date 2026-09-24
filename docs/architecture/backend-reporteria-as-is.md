# Backend Reportería: arquitectura AS-IS

Estado: implementado en el repositorio; operación QA/producción no verificada en esta fase.

## Alcance

`backend-reporteria` es un servicio NestJS separado. Lee PostgreSQL directamente con `pg`, aplica filtros de tenant y sucursal, y entrega respuestas JSON, PDF, Excel y representaciones de tickets. No se encontró un cliente HTTP a la API principal en los módulos revisados; el acoplamiento observable es compartir la base de datos y el modelo de lectura.

## Composición real

`src/app.module.ts` importa `AuthModule`, `DatabaseModule`, `PdfModule` y `ReportsModule` ([fuente](../../backend-reporteria/src/app.module.ts#L1-L10)). `ReportsModule` registra controladores y servicios para ventas, caja, compras, pedidos, domicilios, clientes, turno actual, inventario y reportería operativa ([fuente](../../backend-reporteria/src/modules/reports/reports.module.ts#L1-L78)).

El arranque carga dotenv, aplica el prefijo global `/api`, configura CORS y escucha el puerto `REPORTS_PORT` o `4100` ([fuente](../../backend-reporteria/src/main.ts#L63-L119)). El `docker-compose` y los `.env` pueden declarar otros puertos; esa configuración no prueba el despliegue real.

## Seguridad y aislamiento

- `JwtAuthGuard` valida Bearer JWT con `JWT_SECRET` y exige `sub` y `tenant_id` ([fuente](../../backend-reporteria/src/modules/auth/jwt-auth.guard.ts#L76-L123)).
- En `development` o `test`, `REPORTS_ALLOW_MOCK_AUTH=true` permite actor de prueba por headers `x-report-*`; el guard lo ignora en `qa` y `production` ([fuente](../../backend-reporteria/src/modules/auth/jwt-auth.guard.ts#L29-L35), [pruebas](../../backend-reporteria/src/modules/auth/jwt-auth.guard.spec.ts#L188-L211)).
- `ReportAuthzGuard`, `InventoryReadReportGuard` y `ReportBranchScopeService` consultan roles/permisos y resuelven el alcance de sucursal. Ejemplo: inventario consulta `role_menu_permissions` con `tenant_id` y roles del usuario ([fuente](../../backend-reporteria/src/modules/auth/inventory-read-report.guard.ts#L12-L40)).
- La reportería operativa usa un guard separado: exige JWT, `session_id` válido y sesión activa en `auth_sessions` ([fuente](../../backend-reporteria/src/modules/auth/operational-sales-report-auth.guard.ts#L24-L52)).

## Fuentes de datos y formatos

Los adaptadores SQL consultan directamente ventas, pedidos, compras, caja, inventario, clientes, domicilios y documentos electrónicos. El adaptador de ventas relaciona `sales`, `electronic_documents` e `integration_outbox_events` para mostrar el estado fiscal y la existencia de solicitud ([fuente](../../backend-reporteria/src/modules/reports/sql-adapters/sales-report.adapter.ts#L96-L139)). El reporte operativo expone estado de venta, pago, documento electrónico, número, CUFE y estado del proveedor ([fuente](../../backend-reporteria/src/modules/reports/sql-adapters/operational-sales-report.adapter.ts#L1-L70)).

`DocumentExportService` usa transacción PostgreSQL `REPEATABLE READ READ ONLY`, procesa lotes de 1000 y limita exportaciones a 100000 filas; genera PDF o Excel mediante `PdfModule`, `pdfmake` y `ExcelJS` ([fuente](../../backend-reporteria/src/modules/reports/document-export.service.ts#L1-L80)). Esto demuestra consistencia de lectura para la exportación, no una garantía global del servicio.

## Endpoints verificados por código

Las rutas se distribuyen en controladores de ventas, caja, compras, pedidos, domicilios, clientes, turno, inventario y ventas operativas. Las rutas demo/health están en `ReportsController`; las rutas de dominio están en los controladores bajo `src/modules/reports/`. El inventario completo de métodos debe mantenerse en la matriz de contratos de esta fase, porque algunos controladores comparten prefijos y DTO.

## Pruebas y límites

Existen pruebas unitarias de guards, controladores, servicios, adaptadores SQL, exportación y layouts. No se ejecutaron en B2.3. No se verificó conectividad, esquema efectivo, latencia, permisos de infraestructura ni generación contra datos QA. No se debe presentar este servicio como un sistema de reportes materializado o cacheado: la evidencia revisada muestra consultas SQL directas.
