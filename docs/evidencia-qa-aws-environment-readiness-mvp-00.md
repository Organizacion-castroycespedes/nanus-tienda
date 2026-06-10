# Evidencia QA AWS Environment Readiness - MVP-00.1

Fecha: 2026-06-09

Cambio OpenSpec: `mvp-web-hardening`

Rama: `feat/develop/mvp-web-hardening`

Resultado de readiness: `QA_AWS_READY_FOR_DEPLOY_PLAN`

Motivo: infraestructura base, PM2, Nginx, PostgreSQL, dominios API y SSL fueron inventariados. Aun falta ejecutar deployment plan, validar migraciones QA, smoke remoto y reboot planificado. No se desplego, no se ejecuto migracion, no se reinicio servidor y no se toco PRD.

## Objetivo

Completar el inventario tecnico requerido para preparar un ambiente QA AWS que reciba Manus POS antes de cualquier despliegue PRD.

## Alcance

Incluido:

- Inventario documental de infraestructura QA AWS.
- Inventario documental de servicios QA.
- Matriz de variables de entorno sin secretos reales.
- Plan de migraciones para `V053` y `V054`.
- Inventario de seeds necesarios.
- Checklist de smoke tests remotos.
- Estrategia de rollback.
- Riesgos y siguiente paso recomendado.

Excluido:

- Despliegue en AWS.
- Ejecucion de migraciones en QA.
- Cambios de infraestructura.
- Cambios funcionales en `api/`, `web/`, `backend-perifericos/` o DB.
- Acceso a PRD.

## Fuentes revisadas

| Fuente | Uso |
| --- | --- |
| `docs/deployment/overview.md` | Estado documentado de AWS, PM2, PostgreSQL, Nginx, Docker y CI/CD. |
| `api/ecosystem.config.js` | Patron PM2 conocido para API. |
| `api/.env.example` | Variables API. |
| `web/.env.example` | Variables Web. |
| `backend-perifericos/.env.example` | Variables agent perifericos MOCK. |
| `scripts/config/db.env.example` | Variables DB, seed y SSH deployment. |
| `scripts/ssh/deploy-db.sh` | Flujo remoto de DB: backup, migrate y seed condicional. |
| `scripts/database/seed.sh` | Orden real de seeds. |
| `scripts/database/migrations/V053__products_sale_model_phase_11_1.sql` | Migracion de modelo formal de venta por peso. |
| `scripts/database/migrations/V054__pos_terminal_peripheral_settings_phase_12.sql` | Migracion de terminales POS y settings perifericos. |
| Informacion operativa aportada por el usuario | Inventario real AWS Lightsail, host interno, SO, recursos, PM2, Nginx, PostgreSQL, dominios API y SSL. |

## Datos QA AWS reportados

| Dato | Valor |
| --- | --- |
| Proveedor | AWS Lightsail |
| Instancia | `castroycespedes` |
| Host interno | `ip-172-26-15-126` |
| Sistema operativo | Ubuntu 24.04.4 LTS |
| Region | `us-east-1` |
| CPU | 2 vCPU |
| RAM | 2 GB |
| Disco | 60 GB SSD |
| Disco usado | 13.6% |
| Memoria usada | 38% |
| Swap usado | 1% |
| Reboot requerido | Si |
| Frontend QA | `https://www.apptiendamanus.space` |
| Frontend hosting | Vercel |
| Backend QA | Ubuntu + Nginx + PM2 |
| Estado reportado | Activo |

## PM2 confirmado

| Proceso | Estado |
| --- | --- |
| `api-linux` | online |
| `backend-reporteria-linux` | online |
| `flexi-api-qa` | online |
| `flexi-documental-qa` | online |

## Nginx confirmado

| Item | Valor |
| --- | --- |
| `sites-enabled` | `flexi-qa`, `manus-api` |
| Dominio API Manus | `api.apptiendamanus.space` |
| Proxy Manus `/` | `proxy_pass http://localhost:4020` |
| Proxy Manus `/api/reports/` | `proxy_pass http://localhost:4021/api/reports/` |

## PostgreSQL confirmado

| Base de datos | Owner | Observacion |
| --- | --- | --- |
| `manus_tienda` | `manus_user` | Debe verificarse si es QA dedicado o ambiente compartido antes de tocar datos. |
| `flexibuild_qa` | `flexi_user` | Base QA Flexi inventariada, fuera del scope funcional Manus POS. |

## Certificados SSL confirmados

| Dominio | Estado | Vence |
| --- | --- | --- |
| `api.apptiendamanus.space` | Valido | 2026-07-27 |
| `api.coretenants.space` | Valido | 2026-07-23 |

## Inventario AWS QA

| Item | Estado | Evidencia encontrada | Pendiente |
| --- | --- | --- | --- |
| Instancia QA | Confirmada | AWS Lightsail, instancia `castroycespedes`, estado `Activo`. | Mantener evidencia sin credenciales. |
| Host interno | Confirmado | `ip-172-26-15-126`. | No usar como URL publica. |
| Hostname/API | Confirmado | `api.apptiendamanus.space`. | Validar health remoto. |
| Sistema operativo | Confirmado | Ubuntu 24.04.4 LTS. | Reboot planificado requerido. |
| Region | Confirmada | `us-east-1`. | Sin pendiente documental. |
| CPU/RAM | Confirmado | 2 vCPU / 2 GB RAM; memoria usada 38%; swap 1%. | Validar bajo smoke y carga MVP. |
| Disco | Confirmado | 60 GB SSD; usado 13.6%. | Definir politica de backup/snapshot. |
| PM2 | Confirmado | `api-linux`, `backend-reporteria-linux`, `flexi-api-qa`, `flexi-documental-qa` online. | Validar logs y health de Manus API antes de deployment. |
| Nginx | Confirmado | `sites-enabled`: `flexi-qa`, `manus-api`; Manus `/` proxy a `localhost:4020`; `/api/reports/` proxy a `localhost:4021/api/reports/`. | Validar `nginx -t` durante ventana controlada si aplica. |
| PostgreSQL | Confirmado parcial | DBs `manus_tienda` owner `manus_user` y `flexibuild_qa` owner `flexi_user`. | Verificar si `manus_tienda` es QA dedicado o ambiente compartido antes de tocar datos. |
| Backups | Requiere validacion | `scripts/ssh/deploy-db.sh` invoca `scripts/database/backup.sh` si la DB existe. | Confirmar ruta, retencion y restauracion de backup QA. |
| SSL | Confirmado | `api.apptiendamanus.space` valido hasta 2026-07-27; `api.coretenants.space` valido hasta 2026-07-23. | Renovar antes de julio 2026. |
| Dominios/subdominios | Confirmado parcial | Web QA `https://www.apptiendamanus.space`; API Manus `api.apptiendamanus.space`. | Validar enlace Web -> API. |
| Rutas de despliegue | Parcial | `SSH_REMOTE_DIR` ejemplo: `/opt/manustienda-platform/apps`. API PM2 usa `./dist-bin/api`. | Confirmar rutas reales para API, Web, logs y env files. |
| CI/CD | Pendiente | `docs/deployment/overview.md` indica que no se detectaron workflows CI/CD. | Definir despliegue manual controlado o pipeline QA. |
| Docker | No versionado | `docs/deployment/overview.md` indica que no hay Dockerfile ni compose. | No asumir Docker para QA. |

## Inventario servicios QA

| Servicio | Estado | Configuracion conocida | Pendiente |
| --- | --- | --- | --- |
| API QA | Confirmado para plan de despliegue, requiere smoke | Dominio `api.apptiendamanus.space`; Nginx proxy `/` a `localhost:4020`; PM2 `api-linux` online. | Validar health remoto y version/build antes de tocar datos. |
| Web QA | Definido, requiere validacion | `https://www.apptiendamanus.space` en Vercel. | Validar carga remota, login y `NEXT_PUBLIC_API_BASE_URL` apuntando a API QA. |
| PostgreSQL QA | Confirmado parcial, requiere clasificacion | DB `manus_tienda` owner `manus_user`; DB `flexibuild_qa` owner `flexi_user`. Scripts soportan migrate/seed/backup. | Verificar si `manus_tienda` es QA o compartida. No ejecutar migraciones sin backup/snapshot. |
| backend-perifericos QA | Opcional para MVP Web | Variables MOCK disponibles. Debe quedar `PERIPHERALS_ENABLE_REAL_ADAPTERS=false`. | Definir si se levanta en QA para validar perifericos MOCK o si queda local-only. |

## Matriz de variables de entorno

### API

| Variable | Descripcion | Ambiente | Obligatoria | Observaciones |
| --- | --- | --- | --- | --- |
| `PORT` | Puerto API. | QA API | Si | Ejemplo local `4020`; valor QA pendiente. |
| `NODE_ENV` | Modo runtime. | QA API | Si | Usar `production` o valor QA controlado. |
| `CORS_ORIGIN` | Origenes Web permitidos. | QA API | Si | Debe apuntar a Web QA. No usar comodin sin aprobacion. |
| `APP_VERSION` | Version/release expuesta por API. | QA API | Recomendado | Usar release MVP o build identificable. |
| `REPORTS_API_BASE_URL` | URL servicio reportes. | QA API | Condicional | Requerida si reporteria externa esta activa. |
| `DB_USERNAME` | Usuario DB aplicacion. | QA API | Si | No documentar valor real. |
| `DB_PASSWORD` | Password DB aplicacion. | QA API | Si | Secreto. Solo en env server. |
| `DB_HOST` | Host DB. | QA API | Si | No exponer host interno si es sensible. |
| `DB_PORT` | Puerto DB. | QA API | Si | Usualmente `5432`. |
| `DB_DATABASE` | Nombre DB. | QA API | Si | Debe ser DB QA aislada. |
| `DB_SSL` | SSL hacia DB. | QA API | Condicional | Depende de RDS/EC2/PostgreSQL. |
| `DB_LOGGING` | Logging DB. | QA API | Opcional | En QA usar con cuidado para no exponer datos. |
| `JWT_SECRET` | Firma JWT. | QA API | Si | Secreto critico. No evidenciar valor. |
| `JWT_EXPIRES_IN` | Expiracion JWT. | QA API | Si | Definir politica QA. |
| `LEADS_WEBHOOK_TOKEN` | Token webhook leads. | QA API | Condicional | Sensible. Requerido solo si webhook activo. |
| `DIAN_THIRD_PARTY_LOOKUP_ENABLED` | Activa lookup tercero DIAN. | QA API | Condicional | Para MVP FE, activar solo si fase lo autoriza. |
| `DIAN_THIRD_PARTY_LOOKUP_MODE` | Modo lookup DIAN. | QA API | Condicional | Mantener modo seguro si no hay proveedor real. |
| `DIAN_GET_ACQUIRER_WSDL_URL` | WSDL GetAcquirer. | QA API | Condicional | No usar endpoint real sin aprobacion FE. |
| `DIAN_GET_ACQUIRER_ENDPOINT_URL` | Endpoint GetAcquirer. | QA API | Condicional | No exponer endpoint privado si existe. |
| `DIAN_CERTIFICATE_PATH` | Ruta certificado DIAN. | QA API | Condicional | Sensible operacional. No incluir certificado en repo. |
| `DIAN_CERTIFICATE_PASSWORD` | Password certificado DIAN. | QA API | Condicional | Secreto critico. |
| `DIAN_GET_ACQUIRER_TIMEOUT_MS` | Timeout GetAcquirer. | QA API | Opcional | Ejemplo `15000`. |
| `DIAN_GET_ACQUIRER_HTTP_ENABLED` | Permite HTTP GetAcquirer. | QA API | Condicional | Debe quedar `false` salvo aprobacion explicita. |
| `GOOGLE_DRIVE_CLIENT_EMAIL` | Cuenta servicio Google Drive. | QA API | Condicional | Sensible si reportes/export dependen de Drive. |
| `GOOGLE_DRIVE_PRIVATE_KEY` | Llave privada Google Drive. | QA API | Condicional | Secreto critico. |

### Web

| Variable | Descripcion | Ambiente | Obligatoria | Observaciones |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Base URL API consumida por Web. | QA Web | Si | Debe apuntar a `https://api.apptiendamanus.space` con prefijo real esperado por Web. |
| `NEXT_PUBLIC_REPORTS_API_BASE_URL` | Base URL reportes. | QA Web | Condicional | Requerida si reporteria externa esta activa. |
| `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL` | URL HTTP agent perifericos. | QA Web | Condicional | Para MVP Web puede ser MOCK/local o deshabilitado segun QA. |
| `NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL` | URL WebSocket agent perifericos. | QA Web | Condicional | No debe apuntar a hardware real. |
| `NEXT_PUBLIC_PERIPHERALS_ENABLED` | Habilita integracion perifericos Web. | QA Web | Recomendado | Para QA MOCK puede ser `true`; documentar si `false`. |
| `NEXT_PUBLIC_PERIPHERALS_PRINT_SALE_ENABLED` | Ticket venta MOCK. | QA Web | Recomendado | No activa hardware real. |
| `NEXT_PUBLIC_PERIPHERALS_PRINT_PURCHASE_ENABLED` | Ticket compra MOCK. | QA Web | Recomendado | No activa hardware real. |
| `NEXT_PUBLIC_PERIPHERALS_PRINT_ORDER_ENABLED` | Ticket pedido MOCK. | QA Web | Recomendado | No activa hardware real. |
| `NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED` | Caja MOCK. | QA Web | Recomendado | No activa caja fisica. |
| `NEXT_PUBLIC_PERIPHERALS_SCALE_ENABLED` | Balanza MOCK. | QA Web | Recomendado | No activa balanza fisica. |
| `NEXT_PUBLIC_PERIPHERALS_SCANNER_ENABLED` | Scanner MOCK. | QA Web | Recomendado | No activa scanner fisico. |

### backend-perifericos

| Variable | Descripcion | Ambiente | Obligatoria | Observaciones |
| --- | --- | --- | --- | --- |
| `PERIPHERALS_PORT` | Puerto agent perifericos. | QA perif MOCK | Si, si se despliega | Ejemplo `4050`. |
| `PERIPHERALS_MODE` | Modo agent. | QA perif MOCK | Si, si se despliega | Debe ser `MOCK`. |
| `PERIPHERALS_ENABLE_REAL_ADAPTERS` | Feature flag adapters reales. | QA perif MOCK | Si, si se despliega | Debe quedar `false`. |
| `PERIPHERALS_AGENT_NAME` | Nombre agent. | QA perif MOCK | Opcional | Identificacion tecnica. |
| `PERIPHERALS_ALLOWED_ORIGINS` | CORS del agent. | QA perif MOCK | Si, si se despliega | Debe incluir Web QA si se usa remoto. |
| `PERIPHERALS_LOG_LIMIT` | Limite logs en memoria. | QA perif MOCK | Opcional | Evitar crecimiento excesivo. |
| `PERIPHERALS_PRINTER_WIDTH_CHARS` | Ancho preview ticket. | QA perif MOCK | Opcional | Default operacional. |

### DB, seeds y despliegue remoto

| Variable | Descripcion | Ambiente | Obligatoria | Observaciones |
| --- | --- | --- | --- | --- |
| `DB_HOST` | Host DB para scripts. | QA DB | Si | No exponer si es interno. |
| `DB_PORT` | Puerto DB para scripts. | QA DB | Si | Usualmente `5432`. |
| `DB_NAME` | Nombre DB para scripts. | QA DB | Si | Debe ser QA. |
| `DB_USER` | Usuario app/scripts. | QA DB | Si | No documentar valor sensible si aplica. |
| `DB_PASSWORD` | Password app/scripts. | QA DB | Si | Secreto. |
| `DB_ADMIN_USER` | Usuario admin migraciones/creacion. | QA DB | Condicional | Secreto operacional. |
| `DB_ADMIN_PASSWORD` | Password admin. | QA DB | Condicional | Secreto critico. |
| `ENVIRONMENT` | Ambiente de scripts. | QA DB | Si | Usar `staging` o `qa`, no `prod`. |
| `DB_SCHEMA` | Schema target. | QA DB | Opcional | Default `public`. |
| `SEED_SUPER_ADMIN_EMAIL` | Email usuario admin seed. | QA seed | Si, si se seed inicial | No publicar correo real si sensible. |
| `SEED_SUPER_ADMIN_PASSWORD` | Password admin seed. | QA seed | Si, si se seed inicial | Secreto critico. Rotar luego de seed. |
| `SEED_SUPER_ADMIN_FIRST_NAME` | Nombre admin seed. | QA seed | Opcional | No sensible. |
| `SEED_SUPER_ADMIN_LAST_NAME` | Apellido admin seed. | QA seed | Opcional | No sensible. |
| `SSH_HOST` | Host SSH remoto. | QA deploy DB | Condicional | No exponer real en evidencia publica. |
| `SSH_PORT` | Puerto SSH. | QA deploy DB | Condicional | Default comun `22`, validar QA. |
| `SSH_USER` | Usuario SSH. | QA deploy DB | Condicional | No exponer si es sensible. |
| `SSH_REMOTE_DIR` | Ruta repo/app remota. | QA deploy DB | Condicional | Ejemplo versionado `/opt/manustienda-platform/apps`. |

## Migraciones identificadas

No se ejecutaron migraciones en QA.

| Migracion | Objetivo | Dependencias | Orden | Rollback esperado |
| --- | --- | --- | --- | --- |
| `V053__products_sale_model_phase_11_1.sql` | Agrega `sale_type` y `measurement_unit` a `public.products`, constraints e indices. | Requiere tabla `public.products`. | Ejecutar despues de core products y antes de validar productos pesables/POS. | No hay rollback versionado encontrado. Usar snapshot/backup previo. Rollback manual solo con aprobacion porque quitar columnas puede perder configuracion. |
| `V054__pos_terminal_peripheral_settings_phase_12.sql` | Crea `pos_terminals` y `pos_terminal_peripheral_settings`, triggers, indices y terminal MOCK default si tenant/sucursal default existen. | Requiere `public.tenants`, `public.tenant_branches`, extension `gen_random_uuid()` disponible. | Ejecutar despues de core tenants/branches y despues de V053 por orden numerico. | No hay rollback versionado encontrado. Usar snapshot/backup previo. Rollback manual implicaria remover settings/terminales si no tienen datos operativos necesarios. |

Plan futuro de migraciones QA:

1. Tomar backup/snapshot QA antes de aplicar.
2. Confirmar DB QA aislada y sin datos PRD no anonimizados.
3. Confirmar historial de migraciones previo.
4. Aplicar migraciones en orden versionado.
5. Validar `migrations_history` o mecanismo equivalente.
6. Validar estructuras esperadas.
7. Ejecutar smoke remoto.
8. Documentar resultado.

## Seeds identificados

| Seed | Tipo | Obligatorio QA | Comentario |
| --- | --- | --- | --- |
| `005_seed_general_data.sql` | Datos base | Si | Paises, departamentos, municipios, tenants, branches y personas base segun runbook. |
| `006_seed_menu_items.sql` | Menu | Si | Necesario para navegacion y RBAC visual. |
| `003_seed_roles.sql` | Roles | Si | Necesario para SUPER_ADMIN, ADMIN, USER y permisos. |
| `004_seed_super_admin.sql` | Usuario admin | Si, si ambiente nuevo | Requiere secreto temporal no documentado. Rotar password luego. |
| `009_seed_demo_operational_users.sql` | Usuarios operativos demo | Opcional QA | Util para QA multirol, no usar como PRD. |
| `010_seed_demo_user_roles.sql` | Asignacion roles demo | Opcional QA | Util si se crean usuarios demo. |
| `007_seed_role_menu_permissions.sql` | Permisos menu | Si | Necesario para RBAC/menu. |
| `012_seed_electronic_invoicing_suppliers_menu_permissions.sql` | Permisos FE/proveedores | Recomendado QA FE | Necesario si MVP-02 valida FE completa. |
| Terminales POS por V054 | Configuracion terminal | Si para perifericos MOCK | V054 crea `local-terminal` para tenant/sucursal default si existen. Si no aplica, crear terminal QA controlada por API/UI en fase posterior. |

Notas:

- `scripts/database/seed.sh` ejecuta seeds principales en orden controlado.
- `scripts/ssh/deploy-db.sh` solo ejecuta seed si detecta ambiente nuevo.
- No mezclar seeds demo con PRD.

## Smoke tests QA definidos

No se ejecutaron smoke tests remotos en esta fase. La infraestructura ya esta inventariada para plan de despliegue, pero falta ejecutar smoke remoto controlado.

### Infraestructura

| Smoke | Paso futuro | Esperado |
| --- | --- | --- |
| API responde | `GET https://api.apptiendamanus.space/health` o endpoint health equivalente real. | HTTP 200 y estado saludable. |
| Web responde | Abrir `https://www.apptiendamanus.space`. | Login o shell inicial carga sin error fatal. |
| DB responde | Ejecutar `SELECT 1;` desde host autorizado. | Conexion exitosa y DB QA correcta. |
| PM2 API | Validar `api-linux` en PM2. | Proceso online, sin restart loop. |
| PM2 reporteria | Validar `backend-reporteria-linux` en PM2. | Proceso online, sin restart loop. |
| Nginx | Validar site `manus-api` y request por `api.apptiendamanus.space`. | Proxy `/` a `localhost:4020` y `/api/reports/` a `localhost:4021/api/reports/`. |
| SSL | Verificar certificado de `api.apptiendamanus.space`. | Certificado vigente y cadena valida. |
| Reboot pendiente | Planificar ventana de reboot. | No reiniciar sin aprobacion y ventana controlada. |

### Funcional

| Smoke | Ruta/flujo | Esperado |
| --- | --- | --- |
| Login | `https://www.apptiendamanus.space/login` | Usuario QA autorizado inicia sesion. |
| Dashboard | `/<tenant>/dashboard` o ruta default del sistema. | Menu y datos cargan segun rol. |
| Productos | `/<tenant>/inventory/products` | Lista carga, create/edit basico disponible segun permisos. |
| Clientes | `/<tenant>/customers` | Lista o modulo clientes carga. |
| Proveedores | `/<tenant>/inventory/suppliers` o ruta real. | Lista o modulo proveedores carga. |
| Compras | `/<tenant>/inventory/purchases` | Pantalla carga y permite flujo QA controlado. |
| Pedidos | `/<tenant>/orders` | Pantalla carga y permite flujo QA controlado. |
| POS | `/<tenant>/pos` | POS carga catalogo, carrito y caja segun contexto. |
| Perifericos MOCK | `/<tenant>/admin/peripherals` | Health/devices/logs MOCK cargan si agent esta activo; si no, error controlado. |
| Reporterias | Rutas reporteria MVP | Cargan filtros y datos sin romper RBAC. |
| Version/build | UI o endpoint version | Version/release/build visible o consultable. |
| Migraciones | Query historial o endpoint futuro | Estado de migraciones QA documentado. |

## Rollback definido

No se ejecuto rollback. Estrategia propuesta para el primer despliegue QA:

### Rollback API

Precondiciones:

- Artifact/build anterior conservado.
- Env anterior conservado sin exponer secretos.
- PM2 instalado y proceso identificado.
- Health endpoint conocido.

Pasos:

1. Detener o cambiar proceso PM2 solo durante ventana QA.
2. Restaurar artifact API anterior.
3. Restaurar env anterior si cambio.
4. Ejecutar `pm2 restart manus-api` o procedimiento QA aprobado.
5. Validar health API.
6. Validar login y modulo critico.

Validaciones posteriores:

- API responde.
- Logs sin crash loop.
- Web puede autenticarse.

### Rollback Web

Precondiciones:

- Definir si Web QA corre en EC2, Vercel preview u otro hosting.
- Build anterior conservado.
- Variables publicas anteriores documentadas.

Pasos:

1. Revertir al build/release Web anterior.
2. Restaurar variables publicas si cambiaron.
3. Reiniciar servicio o redeploy segun hosting.
4. Validar login page y rutas MVP.

Validaciones posteriores:

- Web carga assets.
- API base URL correcta.
- No hay error fatal de runtime.

### Rollback DB

Precondiciones:

- Backup/snapshot tomado antes de migraciones.
- Punto de restauracion probado o documentado.
- Ventana QA disponible.
- Confirmar que no hay datos PRD sensibles.

Pasos preferidos:

1. Si la migracion falla antes de commit, abortar transaccion.
2. Si la migracion ya aplico y no hay rollback versionado, restaurar snapshot QA.
3. Si se autoriza rollback manual, ejecutar script nuevo revisado; no editar migracion aplicada.
4. Validar tablas, constraints y `migrations_history` o equivalente.
5. Ejecutar smoke DB/API/Web.

Validaciones posteriores:

- `SELECT 1;` responde.
- API conecta a DB.
- Login funciona.
- Productos/POS cargan.

## Riesgos

- System restart required.
- Certificados SSL vencen en julio 2026: `api.coretenants.space` el 2026-07-23 y `api.apptiendamanus.space` el 2026-07-27.
- No ejecutar reboot sin ventana controlada.
- No ejecutar migraciones sin backup/snapshot.
- Verificar si `manus_tienda` es QA o ambiente compartido antes de tocar datos.
- QA AWS falta smoke remoto autenticado.
- Hardware real no probado.
- Electron pendiente.
- Capacitor pendiente.
- Migraciones `V053` y `V054` no ejecutadas en QA.
- No se encontro rollback versionado para `V053` ni `V054`; requiere snapshot/backup previo.
- NETWORK real preparado por iniciativa anterior pero debe permanecer desactivado.
- `PERIPHERALS_ENABLE_REAL_ADAPTERS` debe permanecer `false`.
- CI/CD no versionado; despliegue QA requiere procedimiento manual o pipeline nuevo.
- Frontend QA esta definido en Vercel, pero falta validar configuracion contra `https://api.apptiendamanus.space`.

## Siguiente paso recomendado

Antes de MVP-01:

1. Crear deployment plan QA usando `https://api.apptiendamanus.space` y Web Vercel `https://www.apptiendamanus.space`.
2. Confirmar si `manus_tienda` es QA dedicado o ambiente compartido.
3. Tomar backup/snapshot antes de cualquier migracion.
4. Planificar reboot por ventana controlada.
5. Validar renovacion SSL antes de julio 2026.
6. Aplicar migraciones V053/V054 solo con aprobacion QA.
7. Ejecutar smoke remoto completo.
8. Actualizar evidencia de ejecucion con resultado posterior.

## Restricciones cumplidas

- No se desplego.
- No se ejecutaron migraciones.
- No se reinicio servidor.
- No se toco PRD.
- No se cambio infraestructura.
- No se modifico codigo funcional.
- No se modifico `api/`.
- No se modifico `web/`.
- No se modifico `backend-perifericos/`.
- No se expusieron credenciales.
- No se activo hardware real.
- No se avanzo a MVP-01.

## Validaciones de cierre

- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS (`Change 'mvp-web-hardening' is valid`)
- `git diff --check`: PASS
- `git status --short`: `?? docs/evidencia-qa-aws-environment-readiness-mvp-00.md`; `?? openspec/changes/mvp-web-hardening/`
