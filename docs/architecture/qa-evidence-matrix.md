# Matriz de evidencia QA B2.4

La existencia de un archivo, prueba o reporte es evidencia histórica/declarada. No equivale a una ejecución actual en QA.

| Área | Evidencia versionada | Alcance | Resultado reportado | Limitación |
|---|---|---|---|---|
| API | `api/src/**/*.spec.ts` | Guards, servicios, ventas, pagos, permisos y contratos | Pruebas presentes | No ejecutadas en B2.4 |
| Outbox | `api/src/modules/integration-outbox/**/*.spec.ts` | Contrato, repositorio, cliente, dispatcher y backoff | Pruebas presentes | No prueba servicio remoto activo |
| Reportería | `backend-reporteria/src/**/*.spec.ts` | Controllers, auth, scope, SQL adapters, exportación y templates | Pruebas presentes | QA runtime no ejecutado aquí |
| Fiscal | `backend-facturacion-electronica/test/*.spec.ts` | Consumer, inbox, procesamiento, worker, proveedores y configuración | Pruebas presentes | DIAN real no probado |
| Fiscal fixtures | `test/fixtures/dian/`, `sale-completed-for-electronic-billing.v1.json` | XML y envelope local | Fixtures disponibles | No son datos productivos |
| Migración/reportes | `scripts/database/tests/20260916_report_product_inventory_readonly_test.sql` | Lectura del reporte V087 | Procedimiento declarado | No ejecutado |
| Reportería QA histórica | `openspec/changes/mejorar-reportes-productos-inventario/qa.md` | Certificación de reporte de inventario y exportación | Reporta PASS el 2026-09-17/18 | Evidencia histórica; ambiente no consultado |
| Smoke QA | `scripts/deploy/qa-deploy-backends.sh`, workflow QA | Health, PID y CORS | Procedimiento automatizado | No ejecutado en esta fase |
| Smoke producción | workflow producción y `prod-deploy-full.sh` | Web, API, reportería y fiscal | Procedimiento con rollback de archivos | No ejecutado en esta fase |

## Pruebas pendientes

- Conectividad API→fiscal con token interno sanitizado y ambiente autorizado.
- Reinicio de cada proceso y verificación de health/readiness.
- Outbox con timeout, lease vencido, duplicado, backoff y fallo terminal.
- Inbox con evento repetido y payload conflictivo.
- Worker fiscal con proveedor mock, proveedor autorizado y recuperación de estado ambiguo.
- PostgreSQL: backup, restore controlado, `migrations_history` y checksum por ambiente.
- Reportería: permisos tenant/sucursal, conexión de base y exportaciones grandes.
- Validación de que QA y producción no comparten credenciales, bases o certificados.
