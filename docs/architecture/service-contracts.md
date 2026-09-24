# Relaciones y contratos entre servicios

## Matriz de relaciones

| Relación | Evidencia | Entorno/puerto | Estado | Limitación |
|---|---|---|---|---|
| Web → API | dominios API, `NEXT_PUBLIC_API_BASE_URL`, controladores API | Variable por ambiente; compose API `4020` | Confirmado/configurado | No se probó request en esta fase |
| API → PostgreSQL | `DatabaseService`, repositorios SQL y `pg` | `DB_HOST`, `DB_PORT`, `DB_DATABASE` | Confirmado | Base activa no consultada |
| API → ReporterÍa | `REPORTS_API_BASE_URL` en `docker-compose.yml` | `reporteria:4021/api` en compose | Declarado | No prueba despliegue real |
| API → Facturación | `BILLING_BACKEND_INTERNAL_BASE_URL` | Default compose `facturacion:4030` | Declarado/configurado | Token y ambiente real no verificados |
| Outbox → Facturación | `billing-integration-client.ts`, dispatcher y `integration_outbox_events` | URL interna del backend FE | Implementado/configurado | Dispatcher depende de flags y token |
| Facturación → API | `sync.service.ts`, `API_BASE_URL` | Compose `http://api:4020` | Implementado/configurado | Sync mock; seguridad externa no verificada |
| Electron → Web | `main.ts`, `config.ts`, `MANUS_WEB_URL` | HTTPS configurado; fallback EMAUS | Implementado | URL heredada requiere revisión operativa |
| Electron → Agent | `agent-client.ts`, `preload.ts` | `http://127.0.0.1:4050` | Confirmado | Proceso local debe existir |
| Agent → Periféricos | adapters, resolver y config | MOCK/REAL, flag explícito | Implementado parcial | Hardware, drivers y corte físico requieren QA |

## API y PostgreSQL

La API crea un pool PostgreSQL y usa SQL directo en servicios/repositorios. El aislamiento se expresa por `tenant_id`, con `branch_id`, `terminal_id`, `pos_session_id` y `cash_session_id` cuando el flujo lo requiere.

## Integration Outbox

El flujo confirmado es:

1. API registra evento en `integration_outbox_events`.
2. Dispatcher reclama eventos pendientes.
3. `billing-integration-client.ts` envía el envelope al backend de facturación.
4. El dispatcher marca publicado, retryable o terminal failure.
5. El backend de facturación procesa el evento con inbox y estado durable.

La ejecución periódica depende de configuración. No se afirma que esté habilitada en producción.

## Puertos declarados

| Servicio | Default o declarado |
|---|---|
| API código | `4000` si no hay `PORT` |
| API Docker | `4020` |
| ReporterÍa código | `4100` si no hay `PORT` |
| ReporterÍa documentación/compose | `4021` |
| Facturación electrónica | `4030` |
| Peripheral Agent | `4050` |
| Web desarrollo | `3000` en documentación Electron |

Las diferencias son de configuración por entorno. No se deben representar como una topología única certificada.
