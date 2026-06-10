# Evidencia QA Backup/Snapshot Readiness - MVP-00.4

Fecha: 2026-06-09

Cambio OpenSpec: `mvp-web-hardening`

Rama: `feat/develop/mvp-web-hardening`

Resultado: `QA_AWS_BACKUP_READY`

## Objetivo

Definir y documentar el procedimiento obligatorio de respaldo antes de cualquier despliegue o migracion en QA AWS.

## Alcance

Incluido:

- Estrategia de snapshot AWS Lightsail.
- Estrategia de backup PostgreSQL.
- Estrategia de backup Nginx.
- Estrategia de backup PM2.
- Estrategia de backup de variables de entorno.
- Validacion de espacio requerido.
- Rollback DB, API y Web.
- Checklist pre-deploy.

Excluido:

- Crear snapshot real.
- Generar dumps reales.
- Ejecutar migraciones.
- Desplegar.
- Reiniciar servidor.
- Modificar PM2.
- Modificar Nginx.
- Modificar PostgreSQL.
- Modificar Vercel.
- Tocar PRD.

## Ambiente QA base

| Componente | Valor |
| --- | --- |
| Proveedor | AWS Lightsail |
| Instancia | `castroycespedes` |
| SO | Ubuntu 24.04.4 LTS |
| API QA | `https://api.apptiendamanus.space` |
| Web QA | `https://www.apptiendamanus.space` |
| PM2 | `api-linux`, `backend-reporteria-linux`, `flexi-api-qa`, `flexi-documental-qa` |
| Nginx | `flexi-qa`, `manus-api` |
| PostgreSQL | `manus_tienda`, `flexibuild_qa` |
| SSL | `api.apptiendamanus.space`, `api.coretenants.space` |

## Estrategia snapshot AWS

Snapshot Lightsail obligatorio antes de:

- Migraciones.
- Cambios Nginx.
- Cambios PM2.
- Cambios PostgreSQL.
- Despliegues mayores.
- Reboot planificado si coincide con deploy.

Checklist:

- [ ] Snapshot creado.
- [ ] Snapshot etiquetado.
- [ ] Fecha registrada.
- [ ] Responsable registrado.
- [ ] Instancia origen registrada: `castroycespedes`.
- [ ] Motivo registrado: pre-deploy QA / pre-migration QA.
- [ ] Evidencia de snapshot guardada fuera del repo si contiene datos sensibles.

Nombre sugerido:

```text
castroycespedes-predeploy-qa-YYYYMMDD-HHMM
```

Reglas:

- No crear snapshot sin ventana aprobada.
- No usar snapshot como reemplazo unico de `pg_dump`.
- No documentar IDs sensibles si el documento sera compartido publicamente.
- Confirmar costo y retencion antes de acumular snapshots.

## Estrategia backup PostgreSQL

Bases en alcance:

- `manus_tienda`
- `flexibuild_qa`

Procedimiento propuesto, no ejecutado:

```bash
mkdir -p /opt/backups/postgres/YYYYMMDD
pg_dump -Fc -d manus_tienda -f /opt/backups/postgres/YYYYMMDD/manus_tienda_predeploy_YYYYMMDD_HHMM.dump
pg_dump -Fc -d flexibuild_qa -f /opt/backups/postgres/YYYYMMDD/flexibuild_qa_predeploy_YYYYMMDD_HHMM.dump
```

Nombre sugerido:

```text
<database>_predeploy_<YYYYMMDD_HHMM>.dump
```

Ubicacion sugerida:

```text
/opt/backups/postgres/<YYYYMMDD>/
```

Validacion posterior sugerida, no ejecutada:

```bash
pg_restore --list /opt/backups/postgres/YYYYMMDD/manus_tienda_predeploy_YYYYMMDD_HHMM.dump
pg_restore --list /opt/backups/postgres/YYYYMMDD/flexibuild_qa_predeploy_YYYYMMDD_HHMM.dump
ls -lh /opt/backups/postgres/YYYYMMDD/
```

Reglas:

- Confirmar si `manus_tienda` es QA dedicado o ambiente compartido antes de migrar.
- No ejecutar migraciones sin dump exitoso.
- No guardar dumps en el repo.
- No copiar dumps a equipos no autorizados.
- No exponer datos personales en evidencia.

## Estrategia backup Nginx

Rutas en alcance:

- `/etc/nginx/nginx.conf`
- `/etc/nginx/sites-enabled/`
- `/etc/nginx/sites-available/`

Procedimiento propuesto, no ejecutado:

```bash
mkdir -p /opt/backups/nginx/YYYYMMDD
sudo cp /etc/nginx/nginx.conf /opt/backups/nginx/YYYYMMDD/nginx.conf
sudo tar -czf /opt/backups/nginx/YYYYMMDD/sites-enabled_predeploy_YYYYMMDD_HHMM.tar.gz /etc/nginx/sites-enabled
sudo tar -czf /opt/backups/nginx/YYYYMMDD/sites-available_predeploy_YYYYMMDD_HHMM.tar.gz /etc/nginx/sites-available
sudo nginx -t
```

Reglas:

- No modificar Nginx durante backup.
- No recargar Nginx durante esta fase.
- Validar `nginx -t` antes y despues de cualquier cambio futuro.
- Guardar evidencia sanitizada de sitios activos: `flexi-qa`, `manus-api`.

## Estrategia backup PM2

Elementos en alcance:

- Lista de procesos PM2.
- `pm2 describe` de procesos relevantes.
- Ecosystem files si existen.
- Estado guardado de PM2.

Procesos:

- `api-linux`
- `backend-reporteria-linux`
- `flexi-api-qa`
- `flexi-documental-qa`

Procedimiento propuesto, no ejecutado:

```bash
mkdir -p /opt/backups/pm2/YYYYMMDD
pm2 list > /opt/backups/pm2/YYYYMMDD/pm2-list_predeploy_YYYYMMDD_HHMM.txt
pm2 describe api-linux > /opt/backups/pm2/YYYYMMDD/api-linux_describe_predeploy_YYYYMMDD_HHMM.txt
pm2 describe backend-reporteria-linux > /opt/backups/pm2/YYYYMMDD/backend-reporteria-linux_describe_predeploy_YYYYMMDD_HHMM.txt
pm2 describe flexi-api-qa > /opt/backups/pm2/YYYYMMDD/flexi-api-qa_describe_predeploy_YYYYMMDD_HHMM.txt
pm2 describe flexi-documental-qa > /opt/backups/pm2/YYYYMMDD/flexi-documental-qa_describe_predeploy_YYYYMMDD_HHMM.txt
pm2 save
```

Reglas:

- No ejecutar `pm2 restart`.
- No ejecutar `pm2 reload`.
- No ejecutar `pm2 delete`.
- No modificar procesos `flexi-*`.
- `pm2 save` solo debe ejecutarse si el estado actual fue validado y aprobado para persistir.

## Estrategia backup env

Variables `.env` pueden contener secretos.

Reglas:

- Nunca guardar secretos en OpenSpec.
- Nunca guardar secretos en docs.
- Nunca pegar `.env` completo en evidencia.
- Respaldar `.env` solo en ubicacion segura del servidor o vault autorizado.
- Registrar solo que el backup existe, fecha, responsable y ruta sanitizada.

Procedimiento propuesto, no ejecutado:

```bash
mkdir -p /opt/backups/env/YYYYMMDD
cp <API_ENV_PATH> /opt/backups/env/YYYYMMDD/api_env_predeploy_YYYYMMDD_HHMM
cp <REPORTS_ENV_PATH> /opt/backups/env/YYYYMMDD/reports_env_predeploy_YYYYMMDD_HHMM
chmod 600 /opt/backups/env/YYYYMMDD/*
```

Evidencia permitida:

- `api .env respaldado: SI/NO`
- `reporteria .env respaldado: SI/NO`
- fecha
- responsable
- ruta sanitizada

Evidencia prohibida:

- `JWT_SECRET`
- passwords DB
- tokens
- private keys
- certificados
- credenciales Google/DIAN

## Espacio requerido

Antes de snapshot, dump o deploy se debe validar espacio:

```bash
df -h
```

Criterio minimo recomendado:

- Root menor a 70% usado antes del dump.
- Espacio libre suficiente para al menos 2 dumps comprimidos.
- Si root supera 80%, detener deploy y liberar/expandir espacio.
- Si root supera 90%, clasificar RED y bloquear deploy.

Estado previo MVP-00.3:

- Root 58G.
- Usado 7.8G.
- Disponible 50G.
- Uso 14%.

Resultado: espacio OK para planificar backup.

## Rollback

### Rollback DB

Aplicar cuando:

- Migracion falla.
- Datos QA quedan inconsistentes.
- API no puede operar por cambio DB.

Prerequisitos:

- Snapshot Lightsail previo.
- Dump PostgreSQL previo.
- Validacion `pg_restore --list` del dump.
- Ventana aprobada.
- Confirmacion de que `manus_tienda` es ambiente correcto.

Validaciones posteriores:

- PostgreSQL activo.
- `manus_tienda` responde.
- API conecta a DB.
- Login funciona.
- Productos/POS cargan.

### Rollback API

Aplicar cuando:

- API no levanta.
- PM2 entra en restart loop.
- Health falla.
- Login/API core falla por 5xx.

Prerequisitos:

- Commit/build anterior identificado.
- `.env` anterior respaldado.
- Estado PM2 previo documentado.
- Nginx sin cambios o respaldado.

Validaciones posteriores:

- `api-linux` online.
- API responde.
- Web puede iniciar sesion.
- Logs sin errores criticos nuevos.

### Rollback Web

Aplicar cuando:

- Deploy Vercel falla.
- Web no carga.
- Variables apuntan a API incorrecta.
- Error fatal de runtime.

Prerequisitos:

- Deployment anterior de Vercel disponible.
- Variables Vercel anteriores conocidas.
- Dominio QA validado.

Validaciones posteriores:

- `https://www.apptiendamanus.space` responde.
- Login page carga.
- Dashboard carga.
- Web consume API QA correcta.

## Checklist pre-deploy

- [ ] Snapshot AWS.
- [ ] Backup DB.
- [ ] Backup Nginx.
- [ ] Backup PM2.
- [ ] Backup env.
- [ ] Espacio validado con `df -h`.
- [ ] `manus_tienda` clasificada como QA dedicado o compartido.
- [ ] Reboot pendiente evaluado y planificado.
- [ ] SSL revisado.
- [ ] OpenSpec valid.
- [ ] Build valid.
- [ ] Tests valid.
- [ ] Smoke ready.
- [ ] Rollback owner definido.
- [ ] Ventana de deploy aprobada.

## Riesgos

- `manus_tienda` podria ser ambiente compartido; no migrar sin confirmarlo.
- Reboot pendiente; no reiniciar sin ventana.
- SSL vence en julio 2026; monitorear renovacion.
- Backups con datos sensibles no deben entrar al repo.
- 2 GB RAM puede ser limitado para build remoto y servicios concurrentes.
- Procesos `flexi-*` comparten servidor; no tocarlos durante deploy Manus.
- Sin dump validado, rollback DB no es aceptable.

## Siguiente paso recomendado

Ejecutar una fase futura MVP-00.5 para backup/snapshot real solo con aprobacion explicita.

Orden recomendado:

1. Confirmar owner y ventana.
2. Clasificar `manus_tienda`.
3. Crear snapshot Lightsail.
4. Generar dumps PostgreSQL.
5. Respaldar Nginx, PM2 y env.
6. Validar backups.
7. Solo entonces autorizar deploy/migraciones QA.

## Resultado

`QA_AWS_BACKUP_READY`

La documentacion obligatoria de respaldo quedo definida. No se ejecuto ningun respaldo real.

## Restricciones cumplidas

- No se desplego.
- No se creo snapshot real.
- No se generaron dumps reales.
- No se ejecutaron migraciones.
- No se reinicio servidor.
- No se modifico PM2.
- No se modifico Nginx.
- No se modifico PostgreSQL.
- No se modifico Vercel.
- No se toco PRD.

## Validaciones de cierre

- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS (`Change 'mvp-web-hardening' is valid`)
- `git diff --check`: PASS
- `git status --short`: `?? docs/evidencia-qa-aws-deployment-plan-mvp-00-2.md`; `?? docs/evidencia-qa-aws-environment-readiness-mvp-00.md`; `?? docs/evidencia-qa-aws-precheck-dryrun-mvp-00-3.md`; `?? docs/evidencia-qa-backup-snapshot-readiness-mvp-00-4.md`; `?? openspec/changes/mvp-web-hardening/`
