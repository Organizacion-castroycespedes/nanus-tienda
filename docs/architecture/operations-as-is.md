# Arquitectura operativa AS-IS: B2.4

Estado: configuración y procedimientos declarados en el repositorio. No se consultaron hosts, contenedores, bases ni servicios activos.

## Topologías identificadas

### Desarrollo local con Docker

`docker-compose.yml` levanta `api`, `reporteria` y `facturacion`. Publica `4020`, `4021` y `4030`, respectivamente. PostgreSQL, Web, Electron y Peripheral Agent permanecen fuera de Compose según el encabezado del archivo ([fuente](../../docker-compose.yml#L1-L8)). Los contenedores usan `host.docker.internal` para PostgreSQL y montan el código fuente con volúmenes ([fuente](../../docker-compose.yml#L22-L44), [fuente](../../docker-compose.yml#L63-L78)).

El compose declara `api → reporteria` en `REPORTS_API_BASE_URL` y `api → facturacion` en `BILLING_BACKEND_INTERNAL_BASE_URL`, además de `depends_on`. Esto prueba configuración local, no conectividad efectiva ni disponibilidad ordenada. `depends_on` no sustituye health checks.

Los Dockerfiles usan Node 20, `dev-entrypoint.sh` y `npm run start:dev`; el entrypoint instala dependencias si el volumen no tiene `node_modules` ([fuente](../../docker/api/Dockerfile#L1-L16), [fuente](../../docker/dev-entrypoint.sh#L1-L17)).

### QA Linux con PM2

El workflow `deploy-qa-backends.yml` construye binarios, los empaqueta y despliega por SSH a un host QA; exige secretos del workflow y ejecuta smoke checks públicos ([fuente](../../.github/workflows/deploy-qa-backends.yml#L1-L30), [fuente](../../.github/workflows/deploy-qa-backends.yml#L70-L150)). El script QA instala tres binarios, ejecuta `pm2 startOrReload`, comprueba PID y consulta:

- API: `4020/api/system/version`.
- Reportería: `4021/api/reports/health`.
- Facturación: `4022/health`.

La configuración PM2 usa un proceso por backend, `autorestart=true`, máximo de reinicios y logs separados ([fuente](../../scripts/pm2/ecosystem.qa.config.js#L1-L57)). El script permite no ejecutar `pm2 save` por defecto. La ejecución histórica o actual no fue comprobada.

### Producción declarada

El workflow de producción se activa en `master`, construye Web y binarios, copia artefactos a un VPS por SSH y reinicia `emaus-web`, `emaus_api`, `emaus_facturacion` y `emaus_reporteria` ([fuente](../../.github/workflows/deploy-prod-master.yml#L1-L35), [fuente](../../.github/workflows/deploy-prod-master.yml#L80-L150)). El script productivo crea snapshots, conserva backups, reinicia PM2 y valida Web, API, reportería y facturación. Si falla el health check, restaura archivos y reinicia ([fuente](../../scripts/deploy/prod-deploy-full.sh#L41-L121)). Esto es procedimiento versionado, no prueba de que producción esté desplegada con esa topología.

## Dependencias de inicio

| Servicio | Proceso | Dependencias declaradas | Health endpoint | Estado de evidencia |
|---|---|---|---|---|
| API | NestJS o binario `api-linux`/`emaus_api` | PostgreSQL; configuración JWT; opcionalmente reportería y fiscal | `/api/system/version` | Código/configurado; runtime no verificado |
| Reportería | NestJS o binario `backend-reporteria-linux`/`emaus_reporteria` | PostgreSQL; `JWT_SECRET` para JWT | `/api/reports/health` | Código/configurado; runtime no verificado |
| Facturación | NestJS o binario `backend-facturacion-electronica-linux`/`emaus_facturacion` | PostgreSQL; proveedor configurado; worker opcional | `/health` | Código/configurado; runtime no verificado |
| Web | Next.js | API local/proxy según entorno | `/login` en smoke productivo | Workflow/configurado; runtime no verificado |

No se encontró health check declarativo de Docker en `docker-compose.yml`. Hay smoke checks de despliegue y endpoints de salud, pero no una prueba de readiness de PostgreSQL o del proveedor fiscal.
