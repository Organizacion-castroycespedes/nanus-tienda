# Evidencia QA AWS Deployment Plan - MVP-00.2

Fecha: 2026-06-09

Cambio OpenSpec: `mvp-web-hardening`

Rama: `feat/develop/mvp-web-hardening`

Estado final esperado de la fase: `QA_AWS_DEPLOY_PLAN_READY`

## Objetivo

Transformar el inventario QA AWS de MVP-00.1 en un procedimiento reproducible para desplegar Manus POS en QA sin ejecutar todavia ningun cambio remoto.

## Alcance

Incluido:

- Arquitectura de despliegue `LOCAL -> GitHub -> QA AWS -> PRD`.
- Runbook de deploy API.
- Runbook de deploy Web en Vercel.
- Runbook de migraciones `V053` y `V054`.
- Runbook de rollback API, Web y DB.
- Checklist de snapshot y backup.
- Checklist de smoke QA remoto.
- Riesgos y siguiente paso recomendado.

Excluido:

- Despliegue.
- Reinicio de servidor.
- Ejecucion de migraciones.
- Cambios PM2.
- Cambios Nginx.
- Cambios PostgreSQL.
- Cambios PRD.
- Cambios de codigo funcional.

## Ambiente QA confirmado

| Componente | Valor |
| --- | --- |
| Proveedor | AWS Lightsail |
| Instancia | `castroycespedes` |
| Host interno | `ip-172-26-15-126` |
| SO | Ubuntu 24.04.4 LTS |
| Region | `us-east-1` |
| Recursos | 2 vCPU, 2 GB RAM, 60 GB SSD |
| Uso actual | Disco 13.6%, memoria 38%, swap 1% |
| Reboot | Requerido, no ejecutar sin ventana |
| Frontend QA | `https://www.apptiendamanus.space` |
| Frontend hosting | Vercel |
| API QA | `https://api.apptiendamanus.space` |
| Backend | Ubuntu + Nginx + PM2 |
| PM2 Manus | `api-linux`, `backend-reporteria-linux` online |
| PM2 otros servicios | `flexi-api-qa`, `flexi-documental-qa` online; no tocar en este plan |
| Nginx sites-enabled | `flexi-qa`, `manus-api` |
| Nginx Manus `/` | `proxy_pass http://localhost:4020` |
| Nginx Manus `/api/reports/` | `proxy_pass http://localhost:4021/api/reports/` |
| PostgreSQL | `manus_tienda` owner `manus_user`; `flexibuild_qa` owner `flexi_user` |
| SSL Manus API | `api.apptiendamanus.space`, valido hasta 2026-07-27 |
| SSL Coretenants | `api.coretenants.space`, valido hasta 2026-07-23 |

## Arquitectura deploy

```text
LOCAL
  - desarrollo y validacion local
  - OpenSpec, evidencia, build/test local
        |
        v
GitHub
  - rama feat/develop/mvp-web-hardening
  - PR/MR hacia develop cuando aplique
  - fuente para despliegue QA
        |
        v
QA AWS
  - Web: Vercel, https://www.apptiendamanus.space
  - API: Lightsail Ubuntu, Nginx -> localhost:4020, PM2 api-linux
  - Reportes: Nginx /api/reports -> localhost:4021/api/reports, PM2 backend-reporteria-linux
  - PostgreSQL: manus_tienda, confirmar si es QA dedicado o compartido
  - backend-perifericos futuro: solo MOCK si se autoriza; adapters reales desactivados
        |
        v
PRD
  - no tocar en MVP-00.2
  - solo avanzar tras QA remoto, migraciones validadas, rollback probado/documentado
```

## Runbook deploy API

No ejecutar en esta fase. Procedimiento propuesto para ventana QA controlada.

### Pre-check API

1. Confirmar owner responsable de la ventana QA.
2. Confirmar que `manus_tienda` es QA dedicado o ambiente compartido.
3. Confirmar rama/revision exacta a desplegar.
4. Confirmar variables QA sin imprimir secretos.
5. Confirmar PM2 actual:
   - `api-linux` online.
   - `backend-reporteria-linux` online.
6. Confirmar Nginx:
   - site `manus-api` habilitado.
   - `/` hacia `localhost:4020`.
   - `/api/reports/` hacia `localhost:4021/api/reports/`.
7. Confirmar SSL vigente.
8. Confirmar que no se tocara `flexi-api-qa` ni `flexi-documental-qa`.

### Backup API

1. Registrar commit/build actual desplegado.
2. Respaldar archivo `.env` remoto en ubicacion segura del servidor.
3. Respaldar configuracion Nginx `manus-api`.
4. Respaldar logs relevantes de PM2 si se requiere evidencia.
5. Tomar snapshot Lightsail antes de cualquier cambio.

### Deploy API

Comandos previstos, no ejecutados:

```bash
git status --short
git fetch --all --prune
git checkout feat/develop/mvp-web-hardening
git pull --ff-only
cd api
npm.cmd run build
```

Notas:

- En Ubuntu QA puede requerirse `npm run build` en vez de `npm.cmd run build`.
- No ejecutar si el working tree remoto esta sucio sin revision humana.
- No modificar Nginx si el proxy actual ya apunta a puertos correctos.

### PM2 reload API

Comandos previstos, no ejecutados:

```bash
pm2 describe api-linux
pm2 reload api-linux --update-env
pm2 logs api-linux --lines 100
```

Reglas:

- Usar `reload` solo si la app soporta reload sin corte.
- Usar `restart` solo con aprobacion si `reload` falla.
- No modificar procesos `flexi-*`.

### Smoke API

1. `GET https://api.apptiendamanus.space/health` o endpoint health real.
2. Validar version/build si existe endpoint.
3. Validar login API con usuario QA sin registrar credenciales.
4. Validar endpoint de menu/permisos.
5. Validar endpoint de productos.
6. Validar endpoint de compras.
7. Validar endpoint de pedidos.
8. Validar endpoint reportes via `/api/reports/`.

### Rollback API inmediato

Aplicar si:

- API no levanta.
- Health falla.
- Login falla por error server.
- Errores 5xx criticos.
- PM2 entra en restart loop.

Pasos:

1. Volver al commit/build anterior.
2. Restaurar `.env` anterior si cambio.
3. Ejecutar `pm2 reload api-linux --update-env` o procedimiento aprobado.
4. Validar health.
5. Documentar causa.

## Runbook deploy Web

Frontend QA vive en Vercel: `https://www.apptiendamanus.space`.

No ejecutar en esta fase.

### Pre-check Web

1. Confirmar proyecto Vercel y rama asociada.
2. Confirmar dominio `www.apptiendamanus.space`.
3. Confirmar variables publicas:
   - `NEXT_PUBLIC_API_BASE_URL` debe apuntar a `https://api.apptiendamanus.space` con prefijo real esperado.
   - `NEXT_PUBLIC_REPORTS_API_BASE_URL` debe apuntar a API reportes QA si aplica.
   - Variables `NEXT_PUBLIC_PERIPHERALS_*` deben mantener MOCK o deshabilitado segun QA.
4. Confirmar que no hay secretos en variables `NEXT_PUBLIC_*`.
5. Confirmar build local o preview antes de promover.

### Deploy Web

Procedimiento previsto:

1. Abrir Vercel.
2. Seleccionar proyecto Manus POS Web.
3. Confirmar rama/revision.
4. Ejecutar deploy preview o promover build ya generado.
5. Validar dominio `https://www.apptiendamanus.space`.

### Smoke Web

1. Login page carga.
2. Login con usuario QA autorizado.
3. Dashboard carga.
4. Menu respeta RBAC.
5. POS carga.
6. Productos carga.
7. Compras carga.
8. Pedidos carga.
9. Admin periféricos no rompe si agent MOCK no esta remoto.
10. Web consume `https://api.apptiendamanus.space`.

### Rollback Web

Aplicar si:

- Vercel build falla.
- Login page no carga.
- Variables apuntan a API incorrecta.
- Error fatal de runtime.

Pasos:

1. Revertir al deployment anterior en Vercel.
2. Restaurar variables previas si fueron cambiadas.
3. Validar login page.
4. Validar dashboard y rutas MVP.

## Runbook migraciones

No ejecutar en esta fase.

Migraciones en alcance:

1. `V053__products_sale_model_phase_11_1.sql`
2. `V054__pos_terminal_peripheral_settings_phase_12.sql`

### Pre-check migraciones

1. Confirmar si `manus_tienda` es QA dedicado o ambiente compartido.
2. Confirmar version PostgreSQL.
3. Confirmar usuario con permisos suficientes.
4. Confirmar historial de migraciones actual.
5. Confirmar que no se esta apuntando a PRD.
6. Confirmar backup/snapshot disponible.

### Orden de ejecucion

1. Snapshot Lightsail.
2. Dump PostgreSQL de `manus_tienda`.
3. Backup de env.
4. Backup de Nginx.
5. Ejecutar migracion `V053`.
6. Validar columnas/constraints/indices de productos.
7. Ejecutar migracion `V054`.
8. Validar tablas `pos_terminals` y `pos_terminal_peripheral_settings`.
9. Validar terminal MOCK si aplica.
10. Ejecutar smoke API/Web.

### Validacion post-migracion

1. `products.sale_type` existe.
2. `products.measurement_unit` existe.
3. Constraints `UNIT`, `WEIGHT`, `BOTH` funcionan.
4. Tabla `pos_terminals` existe.
5. Tabla `pos_terminal_peripheral_settings` existe.
6. Terminal fallback MOCK funciona.
7. POS carga catalogo.
8. Productos pesables siguen visibles.

## Runbook rollback

### Rollback API

Usar cuando el despliegue API falla pero DB esta sana.

Prerequisitos:

- Commit/build anterior identificado.
- Env anterior respaldado.
- PM2 operativo.

Pasos:

1. Volver al build anterior.
2. Restaurar env anterior.
3. Recargar `api-linux`.
4. Validar health y login.

Riesgo:

- Si ya se ejecutaron migraciones no reversibles, rollback API puede no ser suficiente.

### Rollback Web

Usar cuando Vercel deploy falla o apunta a API incorrecta.

Prerequisitos:

- Deployment anterior en Vercel disponible.
- Variables anteriores conocidas.

Pasos:

1. Revertir deployment en Vercel.
2. Restaurar variables si cambiaron.
3. Validar dominio y login.

### Rollback DB

Usar solo si migracion rompe QA y hay backup/snapshot.

Prerequisitos:

- Snapshot Lightsail tomado.
- Dump PostgreSQL tomado.
- Ventana de restauracion aprobada.
- Confirmacion de que `manus_tienda` es ambiente correcto.

Pasos:

1. Detener cambios funcionales.
2. Restaurar dump o snapshot segun impacto.
3. Validar conexion DB.
4. Validar API.
5. Validar Web.
6. Documentar perdida de datos QA si aplica.

Riesgo:

- `V053` y `V054` no tienen rollback versionado encontrado en el inventario. Requieren snapshot/backup.

## Checklist backup

Antes de cualquier migracion o deploy con impacto:

- [ ] Snapshot Lightsail creado.
- [ ] Dump PostgreSQL de `manus_tienda` creado.
- [ ] Restore del dump documentado o validado en ambiente controlado.
- [ ] Backup de `.env` API.
- [ ] Backup de `.env` reporteria si aplica.
- [ ] Backup de Nginx `manus-api`.
- [ ] Commit/build actual registrado.
- [ ] PM2 status registrado.
- [ ] Ventana de rollback aprobada.
- [ ] Reboot planificado o diferido formalmente.

## Smoke QA remoto

### Infraestructura

- [ ] `https://api.apptiendamanus.space` responde.
- [ ] Health API responde.
- [ ] `https://www.apptiendamanus.space` responde.
- [ ] SSL `api.apptiendamanus.space` valido.
- [ ] PM2 `api-linux` online.
- [ ] PM2 `backend-reporteria-linux` online.
- [ ] PostgreSQL `manus_tienda` online.
- [ ] Nginx proxy `/` responde a API.
- [ ] Nginx proxy `/api/reports/` responde a reporteria.

### Funcional

- [ ] Login.
- [ ] Dashboard.
- [ ] Productos.
- [ ] Clientes.
- [ ] Proveedores.
- [ ] Compras.
- [ ] Pedidos.
- [ ] POS.
- [ ] Scanner MOCK no rompe POS.
- [ ] Balanza MOCK no rompe POS.
- [ ] Terminales POS resuelven o usan fallback.
- [ ] Admin/peripherals no rompe si agent MOCK remoto no esta activo.
- [ ] Reportes operativos cargan.

## Riesgos

- `manus_tienda` podria ser ambiente compartido. No tocar datos hasta clasificarlo.
- Reboot pendiente. No reiniciar sin ventana controlada.
- Certificados SSL vencen en julio 2026.
- Hardware real no probado.
- Electron pendiente.
- Capacitor pendiente.
- `V053` y `V054` no tienen rollback versionado encontrado.
- Backend-perifericos real fuera de alcance; adapters reales deben permanecer desactivados.
- 2 GB RAM puede ser justo para build remoto, PM2, PostgreSQL y reporteria.
- Procesos `flexi-*` comparten servidor y no deben afectarse.

## Siguiente paso recomendado

1. Revisar este deployment plan con responsable QA.
2. Confirmar si `manus_tienda` es QA dedicado.
3. Definir ventana de reboot.
4. Definir ventana de backup/snapshot.
5. Ejecutar MVP-00.3 como fase futura de pre-check remoto o dry-run autorizado.
6. Solo despues, ejecutar despliegue QA controlado y documentar evidencia.

## Resultado

`QA_AWS_DEPLOY_PLAN_READY`

El plan existe, pero no se ejecuto. El sistema queda listo para una fase futura de pre-check/deploy QA con autorizacion explicita.

## Restricciones cumplidas

- No se desplego.
- No se reinicio servidor.
- No se ejecutaron migraciones.
- No se modifico PM2.
- No se modifico Nginx.
- No se modifico PostgreSQL.
- No se toco PRD.
- No se modifico codigo funcional.

## Validaciones de cierre

- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS (`Change 'mvp-web-hardening' is valid`)
- `git diff --check`: PASS
- `git status --short`: `?? docs/evidencia-qa-aws-deployment-plan-mvp-00-2.md`; `?? docs/evidencia-qa-aws-environment-readiness-mvp-00.md`; `?? openspec/changes/mvp-web-hardening/`
