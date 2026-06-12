# Tasks: mvp-web-hardening

## MVP-00 - OpenSpec y QA AWS Environment Readiness

- [x] 1. Crear `openspec/changes/mvp-web-hardening/`.
- [x] 2. Crear `proposal.md`.
- [x] 3. Crear `design.md`.
- [x] 4. Crear `specs/mvp-web/spec.md`.
- [x] 5. Crear `tasks.md`.
- [x] 6. Crear `acceptance.md`.
- [x] 7. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 8. Ejecutar `git diff --check`.
- [x] 9. Ejecutar `git status --short`.
- [x] 10. Confirmar que no se implemento funcionalidad en esta fase OpenSpec.
- [x] 11. Definir arquitectura de ambientes `Local -> QA AWS -> PRD`.
- [ ] 12. Definir owner/responsable del ambiente QA AWS.
- [x] 13. Definir URL/base remota sanitizada para Web QA.
- [x] 14. Definir URL/base remota sanitizada para API QA.
- [ ] 15. Confirmar DB QA aislada y sin datos sensibles PRD no anonimizados.
- [x] 16. Definir variables de entorno QA sin secretos en docs.
- [x] 17. Definir estrategia de aplicacion de migraciones en QA AWS.
- [x] 18. Definir validacion de historial/estado de migraciones en QA AWS.
- [x] 19. Definir estrategia de backup/snapshot previo a migraciones QA.
- [x] 20. Definir estrategia de rollback de aplicacion.
- [x] 21. Definir estrategia de rollback de DB o documentar migraciones no reversibles.
- [x] 22. Definir smoke tests remotos minimos para QA AWS.
- [ ] 23. Validar health remoto de API en QA AWS.
- [ ] 24. Validar Web remoto en QA AWS.
- [ ] 25. Validar login/menu remoto con usuario QA autorizado.
- [ ] 26. Validar rutas remotas MVP: POS, productos, compras, pedidos y reportería.
- [ ] 27. Validar version/build y estado de migraciones en QA AWS.
- [x] 28. Crear `docs/evidencia-qa-aws-environment-readiness-mvp-00.md`.
- [x] 29. Emitir `QA_AWS_READY` o `QA_AWS_BLOCKED`.
- [ ] 30. Ejecutar build/test/OpenSpec/git checks.

## MVP-00.1 - Inventario QA AWS y Evidencia Readiness

- [x] 1. Inventariar fuentes versionadas de despliegue, PM2, DB, env, seeds y migraciones.
- [x] 2. Documentar inventario AWS QA real y marcar pendientes sin inventar datos.
- [x] 3. Documentar inventario de servicios API QA, Web QA, PostgreSQL QA y backend-perifericos MOCK opcional.
- [x] 4. Crear matriz de variables API, Web, backend-perifericos y DB/deploy sin secretos.
- [x] 5. Documentar migraciones `V053` y `V054`, dependencias, orden y rollback esperado.
- [x] 6. Documentar seeds obligatorios y opcionales para QA.
- [x] 7. Definir smoke tests remotos de infraestructura y flujos MVP.
- [x] 8. Definir rollback API, Web y DB sin ejecutarlo.
- [x] 9. Crear `docs/evidencia-qa-aws-environment-readiness-mvp-00.md`.
- [x] 10. Emitir resultado `QA_AWS_READY_FOR_DEPLOY_PLAN` porque infraestructura, PM2, Nginx, PostgreSQL, dominios API y SSL fueron inventariados.
- [x] 11. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 12. Ejecutar `git diff --check`.
- [x] 13. Ejecutar `git status --short`.
- [x] 14. Confirmar que no se desplego, no se ejecutaron migraciones y no se toco PRD.
- [x] 15. Actualizar evidencia con proveedor AWS Lightsail, instancia `castroycespedes`, Ubuntu, 2 vCPU, 2 GB RAM, 60 GB SSD, region `us-east-1`, frontend Vercel y backend Ubuntu + Nginx + PM2 activo.
- [x] 16. Actualizar evidencia con host interno `ip-172-26-15-126`, Ubuntu 24.04.4 LTS, uso de disco/memoria/swap, reboot requerido, PM2 online, Nginx sites, dominio API, PostgreSQL y certificados SSL.

## MVP-00.2 - QA AWS Deployment Plan

- [x] 1. Documentar arquitectura de despliegue `LOCAL -> GitHub -> QA AWS -> PRD`.
- [x] 2. Identificar frontend, backend, reportes, PostgreSQL y backend-perifericos futuro.
- [x] 3. Crear runbook deploy API con pre-check, backup, deploy, smoke y rollback.
- [x] 4. Documentar pasos previstos de `git pull`, build, PM2 reload, logs y health checks sin ejecutarlos.
- [x] 5. Crear runbook deploy Web Vercel con rama, variables, build y dominio.
- [x] 6. Crear runbook migraciones `V053` y `V054` con backup, snapshot, migracion, validacion y smoke.
- [x] 7. Crear runbook rollback API, Web y DB.
- [x] 8. Definir checklist snapshot/backup antes de migrar.
- [x] 9. Definir smoke QA remoto de infraestructura y flujos funcionales MVP.
- [x] 10. Documentar riesgos: `manus_tienda` compartido, reboot pendiente, SSL julio 2026, hardware real, Electron y Capacitor.
- [x] 11. Crear `docs/evidencia-qa-aws-deployment-plan-mvp-00-2.md`.
- [x] 12. Emitir resultado `QA_AWS_DEPLOY_PLAN_READY`.
- [x] 13. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 14. Ejecutar `git diff --check`.
- [x] 15. Ejecutar `git status --short`.
- [x] 16. Confirmar que no se desplego, no se ejecutaron migraciones, no se reinicio servidor, no se modifico PM2/Nginx/PostgreSQL y no se toco PRD.

## MVP-00.3 - Pre-check remoto / Dry-run autorizado

- [x] 1. Intentar SSH de solo lectura con `BatchMode=yes`.
- [x] 2. Documentar intento SSH inicial bloqueado por `Permission denied (publickey)` y posterior recepcion de salidas sanitizadas.
- [x] 3. Registrar `hostname`, `uname -a`, `lsb_release -a`, `free -h`, `df -h` y `uptime` sanitizados de QA AWS.
- [x] 4. Registrar `node -v` y `npm -v` sanitizados de QA AWS.
- [x] 5. Registrar `pm2 list` sanitizado de QA AWS.
- [ ] 6. Ejecutar `pm2 describe <name>` para procesos QA.
- [x] 7. Registrar `sudo nginx -t` y listado `/etc/nginx/sites-enabled` sanitizados.
- [x] 8. Registrar `sudo certbot certificates` sanitizado.
- [x] 9. Registrar PostgreSQL activo y bases desde salida sanitizada; `SELECT version();` queda recomendado si se requiere version exacta.
- [ ] 10. Localizar rutas deploy y documentar `git status`, `git branch` y rama actual sin `git pull`.
- [x] 11. Ejecutar health checks publicos Web/API sin modificar remoto.
- [x] 12. Clasificar riesgos GREEN/YELLOW/RED.
- [x] 13. Crear `docs/evidencia-qa-aws-precheck-dryrun-mvp-00-3.md`.
- [x] 14. Emitir resultado `QA_AWS_DEPLOY_READY`.
- [x] 15. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 16. Ejecutar `git diff --check`.
- [x] 17. Ejecutar `git status --short`.
- [x] 18. Confirmar que no se desplego, no se reinicio, no se migro, no se modifico PM2/Nginx/PostgreSQL/Vercel y no se toco PRD.

## MVP-00.4 - Backup/Snapshot QA antes de deploy

- [x] 1. Documentar estrategia de snapshot AWS Lightsail antes de migraciones, cambios Nginx, cambios PM2, cambios PostgreSQL y despliegues mayores.
- [x] 2. Crear checklist de snapshot: creado, etiquetado, fecha y responsable.
- [x] 3. Documentar estrategia de backup PostgreSQL con `pg_dump` para `manus_tienda` y `flexibuild_qa` sin ejecutarlo.
- [x] 4. Documentar nombres sugeridos, ubicacion sugerida y validacion posterior de dumps.
- [x] 5. Documentar estrategia backup Nginx para `nginx.conf`, `sites-enabled` y `sites-available` sin ejecutarla.
- [x] 6. Documentar estrategia backup PM2 para ecosystem files, `pm2 save` y lista de procesos sin ejecutarla.
- [x] 7. Documentar estrategia backup `.env` sin guardar secretos en OpenSpec ni docs.
- [x] 8. Documentar validacion de espacio con `df -h` antes de snapshot, dump y deploy.
- [x] 9. Documentar rollback DB, API y Web con prerequisitos y validaciones.
- [x] 10. Crear checklist pre-deploy obligatorio.
- [x] 11. Crear `docs/evidencia-qa-backup-snapshot-readiness-mvp-00-4.md`.
- [x] 12. Emitir resultado `QA_AWS_BACKUP_READY`.
- [x] 13. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 14. Ejecutar `git diff --check`.
- [x] 15. Ejecutar `git status --short`.
- [x] 16. Confirmar que no se desplego, no se creo snapshot real, no se generaron dumps, no se migro, no se reinicio y no se toco PM2/Nginx/PostgreSQL/Vercel/PRD.

## MVP-00.4.2 - QA Database Bootstrap Strategy

- [x] 1. Analizar `scripts/database/`, `scripts/database/migrations/`, `seed.sh`, `migrate.sh`, `migrate_prd.sh`, `run_migrations.sh` y `docs/database-runbook.md`.
- [x] 2. Definir decision de crear DB nueva `manus_tienda_qa` sin migrar datos desde `manus_tienda`.
- [x] 3. Documentar orden de bootstrap: schema/base, modulos, funciones, migraciones incrementales, seeds minimos y smoke SQL.
- [x] 4. Documentar seeds minimos para tenant, sucursal, roles, menu, permisos, usuarios QA, consumidor final, terminal POS y settings MOCK.
- [x] 5. Crear `docs/runbook-bootstrap-manus-tienda-qa.md`.
- [x] 6. Crear `docs/evidencia-qa-database-bootstrap-strategy-mvp-00-4-2.md`.
- [x] 7. Crear script seguro no destructivo `scripts/database/bootstrap-manus-tienda-qa.sh`.
- [x] 8. Confirmar que el script exige `CONFIRM_CREATE_QA_DB=YES`, rechaza DB que no termina en `_qa`, no contiene passwords, usa env externo, no dropea DB y no toca `manus_tienda`.
- [x] 9. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 10. Ejecutar `git diff --check`.
- [x] 11. Ejecutar `git status --short`.
- [x] 12. Confirmar que no se ejecuto bootstrap, no se creo DB real, no se corrieron migraciones reales, no se toco PRD y no se modificaron datos existentes.

## MVP-00.4.3 - Env externo y checklist final para bootstrap QA

- [x] 1. Crear `scripts/database/config/bootstrap-manus-tienda-qa.env.example` con placeholders seguros.
- [x] 2. Documentar archivo real no versionado `scripts/database/config/bootstrap-manus-tienda-qa.env`.
- [x] 3. Agregar regla segura a `.gitignore` para `scripts/database/config/*.env` sin ignorar `*.env.example`.
- [x] 4. Crear `docs/checklist-bootstrap-manus-tienda-qa.md`.
- [x] 5. Revisar `bootstrap-manus-tienda-qa.sh` sin ejecutarlo.
- [x] 6. Corregir aliases seguros del script para `DB_OWNER`, `DB_APP_PASSWORD`, `APPLY_OPTIONAL_FIXTURES`, `RUN_SMOKE_SQL` y `LOG_DIR`.
- [x] 7. Confirmar que el script requiere `CONFIRM_CREATE_QA_DB=YES`.
- [x] 8. Confirmar que el script rechaza DB distinta a `manus_tienda_qa`.
- [x] 9. Confirmar que el script no contiene `DROP DATABASE` ni passwords reales.
- [x] 10. Crear `docs/evidencia-qa-bootstrap-env-checklist-mvp-00-4-3.md`.
- [x] 11. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 12. Ejecutar `git diff --check`.
- [x] 13. Ejecutar `git status --short`.
- [x] 14. Confirmar que no se creo DB real, no se ejecuto bootstrap, no se migró, no se toco `manus_tienda`, no se toco PRD y no se modifico infraestructura.

## MVP-00.4.4 - Validar env externo y manifiesto SQL

- [x] 1. Verificar que no existia `scripts/database/bootstrap-manus-tienda-qa.manifest.md`.
- [x] 2. Inventariar SQL relevantes bajo `scripts/database/`, `scripts/database/migrations/`, subcarpetas y seeds disponibles.
- [x] 3. Crear `scripts/database/bootstrap-manus-tienda-qa.manifest.md` con orden logico para DB limpia.
- [x] 4. Confirmar que `V053__products_sale_model_phase_11_1.sql` y `V054__pos_terminal_peripheral_settings_phase_12.sql` estan incluidas.
- [x] 5. Identificar seeds minimos: tenant/sucursal, roles, usuarios QA, menu, permisos/RBAC, consumidor final, metodos de pago, terminal POS y peripheral settings MOCK.
- [x] 6. Documentar relacion con `bootstrap-manus-tienda-qa.sh`, `seed.sh`, `migrate_prd.sh` y `docs/database-runbook.md`.
- [x] 7. Documentar que `migrate_prd.sh` conserva nombre historico y solo debe usarse para QA si el runbook lo permite.
- [x] 8. Validar `scripts/database/config/bootstrap-manus-tienda-qa.env.example`.
- [x] 9. Validar que `.gitignore` protege `scripts/database/config/*.env` y no ignora `*.env.example`.
- [x] 10. Revisar `scripts/database/bootstrap-manus-tienda-qa.sh` sin ejecutarlo.
- [x] 11. Ajustar `bootstrap-manus-tienda-qa.sh` para validar/imprimir la ruta del manifiesto SQL sin ejecutar SQL adicional.
- [x] 12. Actualizar `docs/checklist-bootstrap-manus-tienda-qa.md` con seccion `Manifiesto SQL cronologico`.
- [x] 13. Crear `docs/evidencia-qa-bootstrap-manifest-env-validation-mvp-00-4-4.md`.
- [x] 14. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 15. Ejecutar `git diff --check`.
- [x] 16. Ejecutar `git status --short`.
- [x] 17. Confirmar que no se ejecuto bootstrap, no se creo DB, no se ejecutaron migraciones, no se toco `manus_tienda`, no se toco PRD y no se modifico infraestructura.

## MVP-00.4.5 - Backup real + env real QA

Estado: `QA_BACKUP_CONFIRMED`.

- [x] 1. Intentar acceso SSH controlado a `ubuntu@api.apptiendamanus.space`.
- [x] 2. Documentar bloqueo SSH por `Permission denied (publickey)`.
- [x] 3. Documentar snapshot Lightsail como pendiente de confirmacion humana.
- [x] 4. Crear carpeta remota `/home/ubuntu/backups/manus-qa/20260610-0030`.
- [x] 5. Crear dump PostgreSQL de `manus_tienda`.
- [x] 6. Validar dump con archivo existente, tamano mayor a cero y `pg_restore -l`.
- [x] 7. Respaldar Nginx.
- [x] 8. Respaldar PM2 con salidas `pm2 list` y `pm2 describe` sin ejecutar `pm2 save`.
- [x] 9. Respaldar env remoto sin exponer secretos.
- [x] 10. Preparar `scripts/database/config/bootstrap-manus-tienda-qa.env` real fuera de git.
- [x] 11. Validar que `.gitignore` protege `scripts/database/config/*.env` y no ignora examples.
- [x] 12. Confirmar que no se ejecuto validacion de script por falta de modo dry-run y env real.
- [x] 13. Crear `docs/evidencia-qa-backup-real-env-qa-mvp-00-4-5.md`.
- [x] 14. Emitir resultado `QA_BACKUP_CONFIRMED`.
- [x] 15. Registrar estado intermedio `QA_BACKUP_PENDING_EXECUTION` antes de la ejecucion manual.
- [x] 16. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 17. Ejecutar `git diff --check`.
- [x] 18. Ejecutar `git status --short`.
- [x] 19. Confirmar que no se ejecuto bootstrap, no se creo DB, no se ejecutaron migraciones, no se toco `manus_tienda`, no se reinicio servidor, no se hizo deploy y no se toco PRD.
- [x] 20. Actualizar evidencia con snapshot `castroycespedes-pre-manus-tienda-qa-bootstrap-20260610`, backup dir, dump `487K`, `pg_restore -l OK`, Nginx, PM2, env y `git check-ignore`.

## MVP-00.4.5A - Preparacion de ejecucion manual de backups QA

- [x] 1. Confirmar que no se intento SSH en esta fase.
- [x] 2. Actualizar `docs/evidencia-qa-backup-real-env-qa-mvp-00-4-5.md` a `QA_BACKUP_PENDING_EXECUTION`.
- [x] 3. Documentar motivo: infraestructura accesible, procedimientos existentes y ejecucion manual pendiente.
- [x] 4. Crear `docs/checklist-exec-backup-qa.md`.
- [x] 5. Agregar checklist de snapshot Lightsail, carpeta backups, dump, validacion dump, Nginx, PM2, env real y `CONFIRM_CREATE_QA_DB=NO`.
- [x] 6. Agregar seccion `Comandos manuales a ejecutar` sin ejecutarlos.
- [x] 7. Confirmar que no se ejecuto backup, no se desplego, no se creo `manus_tienda_qa`, no se ejecuto bootstrap y no se pidieron llaves SSH.
- [x] 8. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 9. Ejecutar `git diff --check`.
- [x] 10. Ejecutar `git status --short`.

## MVP-00.4.6 - Bootstrap real manus_tienda_qa

Estado: `PLAN_READY_NO_EXECUTION`.

- [x] 1. Revisar `scripts/database/bootstrap-manus-tienda-qa.sh`.
- [x] 2. Revisar `scripts/database/bootstrap-manus-tienda-qa.manifest.md`.
- [x] 3. Crear `docs/runbook-exec-bootstrap-manus-tienda-qa.md`.
- [x] 4. Documentar prerequisitos y backups confirmados.
- [x] 5. Documentar variables requeridas sin secretos.
- [x] 6. Documentar validaciones previas.
- [x] 7. Documentar comandos exactos de preparacion y bootstrap sin ejecutarlos.
- [x] 8. Confirmar objetivo `DB_NAME=manus_tienda_qa`.
- [x] 9. Confirmar objetivo `DB_OWNER=manus_qa_user`.
- [x] 10. Confirmar `public.migrations_history`.
- [x] 11. Confirmar validacion requerida de `V053` y `V054`.
- [x] 12. Confirmar seeds minimos esperados.
- [x] 13. Definir smoke SQL posterior.
- [x] 14. Definir rollback.
- [x] 15. Definir criterios `QA_DB_BOOTSTRAP_READY`.
- [x] 16. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 17. Ejecutar `git diff --check`.
- [x] 18. Confirmar que no se ejecuto bootstrap, no se creo `manus_tienda_qa`, no se migró y no se desplego.

## MVP-00.4.7A - Bootstrap Failure Analysis

Estado: `QA_BOOTSTRAP_FIXTURE_CLASSIFIED`.

- [x] 1. Analizar `scripts/database/migrations/20260505_reporting_pos_fixtures.sql`.
- [x] 2. Analizar `scripts/database/migrate_prd.sh`.
- [x] 3. Analizar `scripts/database/bootstrap-manus-tienda-qa.sh`.
- [x] 4. Analizar `scripts/database/bootstrap-manus-tienda-qa.manifest.md`.
- [x] 5. Determinar que el fixture se ejecuto porque estaba en `scripts/database/migrations/` y el runner ejecutaba todos los `*.sql`.
- [x] 6. Determinar que `20260505_reporting_pos_fixtures.sql` es fixture/demo opcional y no migracion estructural obligatoria.
- [x] 7. Ajustar `migrate_prd.sh` para saltar el fixture por defecto.
- [x] 8. Ajustar `migrate_prd.sh` para ejecutarlo solo con `RUN_OPTIONAL_QA_FIXTURES=YES` o `APPLY_OPTIONAL_FIXTURES=YES`.
- [x] 9. Ajustar `bootstrap-manus-tienda-qa.sh` para exportar `RUN_OPTIONAL_QA_FIXTURES` y documentar en log el comportamiento.
- [x] 10. Mantener `APPLY_OPTIONAL_FIXTURES=NO` como default seguro.
- [x] 11. Actualizar `bootstrap-manus-tienda-qa.manifest.md`.
- [x] 12. Actualizar `docs/runbook-exec-bootstrap-manus-tienda-qa.md`.
- [x] 13. Crear `docs/evidencia-qa-bootstrap-failure-analysis-mvp-00-4-7A.md`.
- [x] 14. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 15. Ejecutar `git diff --check`.
- [x] 16. Ejecutar `git status --short`.
- [x] 17. Confirmar que no se reintento bootstrap, no se ejecutaron migraciones, no se borro `manus_tienda_qa`, no se toco `manus_tienda`, no se toco PRD, no se desplego y no se reinicio servidor.

## MVP-00.4.7B - Bootstrap Legacy Reporting Patch Fix

Estado: `QA_BOOTSTRAP_LEGACY_PATCH_FIXED`.

- [x] 1. Analizar `scripts/database/migrations/20260505_sync_local_to_aws_reporting_and_sales.sql`.
- [x] 2. Confirmar fallo por `DROP FUNCTION` sin `IF EXISTS`.
- [x] 3. Buscar otros `DROP FUNCTION` sin `IF EXISTS` en el mismo archivo.
- [x] 4. Confirmar que solo existia un `DROP FUNCTION` en el archivo.
- [x] 5. Cambiar `DROP FUNCTION` problematico a `DROP FUNCTION IF EXISTS`.
- [x] 6. Documentar que `20260505_sync_local_to_aws_reporting_and_sales.sql` es patch legacy obligatorio pero debe ser idempotente.
- [x] 7. Actualizar `scripts/database/bootstrap-manus-tienda-qa.manifest.md`.
- [x] 8. Actualizar `docs/runbook-exec-bootstrap-manus-tienda-qa.md`.
- [x] 9. Crear `docs/evidencia-qa-bootstrap-legacy-reporting-patch-fix-mvp-00-4-7B.md`.
- [x] 10. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 11. Ejecutar `git diff --check`.
- [x] 12. Ejecutar `git status --short`.
- [x] 13. Confirmar que no se ejecuto bootstrap, no se ejecutaron migraciones, no se toco AWS, no se toco `manus_tienda`, no se borro `manus_tienda_qa`, no se desplego y no se reinicio servidor.

## MVP-00.4.7C - Migration Dependency Analysis

Estado: `QA_MIGRATION_DEPENDENCY_CLASSIFIED`.

- [x] 1. Revisar `scripts/database/migrations/V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql`.
- [x] 2. Identificar tablas afectadas: `public.customers` y `public.suppliers`.
- [x] 3. Identificar que `document_type_code` es dependencia previa, no columna creada por V052.
- [x] 4. Confirmar que `20260603_electronic_invoicing_customers_phase_1.sql` crea `customers.document_type_code`.
- [x] 5. Confirmar que `20260604_electronic_invoicing_suppliers_phase_1.sql` crea `suppliers.document_type_code`.
- [x] 6. Confirmar que rollbacks `20260603_*_rollback.sql` y `20260604_*_rollback.sql` eliminan `document_type_code`.
- [x] 7. Analizar `scripts/database/migrate_prd.sh` y detectar que el listado forward incluye todos los `*.sql` sin excluir `*_rollback.sql`.
- [x] 8. Clasificar el fallo como bug de runner/clasificacion de migraciones, no como columna renombrada.
- [x] 9. Proponer fix seguro: excluir `*_rollback.sql` del flujo forward y mantener rollbacks solo para ejecucion manual controlada.
- [x] 10. Crear `docs/evidencia-qa-migration-dependency-analysis-v052.md`.
- [x] 11. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 12. Ejecutar `git diff --check`.
- [x] 13. Ejecutar `git status --short`.
- [x] 14. Confirmar que no se ejecuto bootstrap, no se ejecutaron migraciones, no se toco AWS, no se toco `manus_tienda`, no se modifico `manus_tienda_qa`, no se desplego y no se reinicio servidor.

## MVP-00.4.7D - Excluir rollback scripts del forward migration runner

Estado: `QA_FORWARD_RUNNER_EXCLUDES_ROLLBACK`.

- [x] 1. Revisar como `scripts/database/migrate_prd.sh` selecciona archivos SQL.
- [x] 2. Agregar deteccion de rollback SQL para `*_rollback.sql` y `*rollback*.sql`.
- [x] 3. Excluir rollback SQL del flujo forward antes de validar/aplicar migraciones.
- [x] 4. Registrar en logs cada rollback omitido con `Skipping rollback SQL in forward migration runner`.
- [x] 5. Mantener rollback scripts disponibles solo para rollback manual documentado.
- [x] 6. Actualizar `scripts/database/bootstrap-manus-tienda-qa.sh` para documentar en log que rollback SQL queda excluido por el runner.
- [x] 7. Actualizar `scripts/database/bootstrap-manus-tienda-qa.manifest.md`.
- [x] 8. Actualizar `docs/runbook-exec-bootstrap-manus-tienda-qa.md`.
- [x] 9. Crear `docs/evidencia-qa-forward-runner-excludes-rollback-mvp-00-4-7D.md`.
- [x] 10. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 11. Ejecutar `git diff --check`.
- [x] 12. Ejecutar `git status --short`.
- [x] 13. Confirmar que no se ejecuto bootstrap, no se ejecutaron migraciones, no se toco AWS, no se toco `manus_tienda`, no se modifico `manus_tienda_qa`, no se borraron datos, no se desplego y no se reinicio servidor.

## MVP-00.5 - Database Drift Analysis

Estado: `QA_SCHEMA_DRIFT_CLASSIFIED`.

- [x] 1. Analizar compare report `D:/compare-manus_tienda_qa-manus_tienda_prd-report.html`.
- [x] 2. Clasificar missing columns.
- [x] 3. Clasificar missing indexes.
- [x] 4. Clasificar missing constraints.
- [x] 5. Clasificar missing foreign keys.
- [x] 6. Clasificar missing triggers.
- [x] 7. Clasificar missing functions.
- [x] 8. Clasificar function source differences.
- [x] 9. Clasificar SQL no versionados.
- [x] 10. Clasificar cambios manuales o drift de entorno DB.
- [x] 11. Crear `docs/evidencia-database-drift-analysis-mvp-00-5.md`.
- [x] 12. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 13. Ejecutar `git diff --check`.
- [x] 14. Ejecutar `git status --short`.
- [x] 15. Confirmar que no se ejecutaron migraciones, no se toco QA, no se toco PRD, no se modificaron datos y no se hizo deploy.

## MVP-00.5A - Database Drift Remediation Plan

Estado: `QA_SCHEMA_DRIFT_REMEDIATION_PLANNED`.

- [x] 1. Revisar `docs/evidencia-database-drift-analysis-mvp-00-5.md`.
- [x] 2. Identificar SQL existente `scripts/database/finance/migrations/20260503_2030_finance_cash_payment_traceability.sql`.
- [x] 3. Explicar que no entra al bootstrap porque `migrate_prd.sh` no lo incluye y el wrapper QA no ejecuta `finance/run_finance_migrations.sh`.
- [x] 4. Proponer migracion versionada para `purchases.total_original`.
- [x] 5. Proponer migracion versionada para `idx_auditoria_eventos_purchase_liquidated`.
- [x] 6. Analizar overwrite de `report_purchase_ticket` por `V047`.
- [x] 7. Definir orden de correccion.
- [x] 8. Crear `docs/evidencia-database-drift-remediation-plan-mvp-00-5A.md`.
- [x] 9. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 10. Ejecutar `git diff --check`.
- [x] 11. Ejecutar `git status --short`.
- [x] 12. Confirmar que no se ejecutaron migraciones, no se toco QA, no se toco PRD, no se modificaron datos y no se crearon migraciones ejecutables.

## MVP-00.5B - Database Drift Remediation Implementation

Estado: `QA_SCHEMA_DRIFT_REMEDIATION_IMPLEMENTED`.

- [x] 1. Revisar `docs/evidencia-database-drift-analysis-mvp-00-5.md`.
- [x] 2. Revisar `docs/evidencia-database-drift-remediation-plan-mvp-00-5A.md`.
- [x] 3. Ajustar `scripts/database/migrate_prd.sh` para incluir `finance/migrations/20260503_2030_finance_cash_payment_traceability.sql` en el flujo forward.
- [x] 4. Crear `scripts/database/migrations/V055__purchases_total_original_drift_fix.sql`.
- [x] 5. Confirmar que `V055` agrega `purchases.total_original` si no existe, usa tipo compatible y hace backfill seguro desde `total`.
- [x] 6. Crear `scripts/database/migrations/V056__purchase_liquidation_audit_index_drift_fix.sql`.
- [x] 7. Confirmar que `V056` crea `idx_auditoria_eventos_purchase_liquidated` si no existe y no depende de datos.
- [x] 8. Crear `scripts/database/migrations/V057__restore_report_purchase_ticket_after_v047.sql`.
- [x] 9. Confirmar que `V057` restaura `report_purchase_ticket(uuid, text, uuid, uuid, uuid)` con `CREATE OR REPLACE FUNCTION`.
- [x] 10. Actualizar `scripts/database/bootstrap-manus-tienda-qa.manifest.md`.
- [x] 11. Actualizar `docs/runbook-exec-bootstrap-manus-tienda-qa.md`.
- [x] 12. Actualizar evidencia drift remediation con referencia a implementacion.
- [x] 13. Crear `docs/evidencia-database-drift-remediation-implementation-mvp-00-5B.md`.
- [x] 14. Ejecutar `bash -n scripts/database/migrate_prd.sh`.
- [x] 15. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 16. Ejecutar `git diff --check`.
- [x] 17. Ejecutar `git status --short`.
- [x] 18. Confirmar que no se ejecuto bootstrap, no se ejecutaron migraciones, no se toco QA, no se toco PRD y no se modificaron datos reales.

## MVP-00.7A - Deploy Automation + Missing Backends Discovery

Estado: `QA_DEPLOY_AUTOMATION_DISCOVERY_READY`.

- [x] 1. Inventariar estructura actual del repo: `api`, `backend-reporteria`, `backend-facturacion-electronica`, `backend-perifericos`, `web`.
- [x] 2. Inventariar `package.json` relevantes y scripts de build existentes.
- [x] 3. Confirmar que `backend-facturacion-electronica` existe como servicio NestJS y no debe crearse desde cero.
- [x] 4. Confirmar que `backend-perifericos` existe como servicio NestJS MOCK y no debe crearse desde cero.
- [x] 5. Clasificar gap de `backend-facturacion-electronica`: falta `build:bin`/`pkg` si QA exige binario.
- [x] 6. Clasificar gap de `backend-perifericos`: falta `build:bin`/`pkg` si QA exige binario.
- [x] 7. Definir arquitectura QA AWS objetivo: `api-linux:4020`, `backend-reporteria-linux:4021`, `backend-facturacion-electronica-linux:4022`, `backend-perifericos-linux:4023`.
- [x] 8. Disenar estructura runtime `/home/ubuntu/manustienda/build*` por servicio.
- [x] 9. Disenar PM2 objetivo con procesos, cwd, script, estrategia restart y logs.
- [x] 10. Disenar GitHub Actions para trigger `push` a `release/evolutivo/0.0.1`.
- [x] 11. Definir estrategia de build, upload SSH/SCP, backup, reemplazo atomico, `chmod +x`, PM2 restart y smoke.
- [x] 12. Definir GitHub Secrets requeridos sin crear secrets reales.
- [x] 13. Definir smoke tests para API, reporteria, facturacion electronica y perifericos.
- [x] 14. Crear `docs/evidencia-deploy-automation-missing-backends-discovery-mvp-00-7A.md`.
- [x] 15. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 16. Ejecutar `git diff --check`.
- [x] 17. Ejecutar `git status --short`.
- [x] 18. Confirmar que no se ejecuto deploy, no se toco AWS, no se modificaron secretos, no se crearon GitHub secrets reales, no se compilo y no se reinicio PM2.

## MVP-00.7B - Binarios unificados

Estado: `QA_BACKEND_BINARIES_STANDARDIZED`.

- [x] 1. Revisar `package.json` de `api`, `backend-reporteria`, `backend-facturacion-electronica` y `backend-perifericos`.
- [x] 2. Documentar por servicio script `build`, script `build:bin`, configuracion `pkg`, targets, outputPath, binarios esperados, assets y riesgo de secretos.
- [x] 3. Normalizar `backend-facturacion-electronica` con `build:bin`, `pkg`, targets `node18-linux-x64`/`node18-win-x64`, outputPath `dist-bin` y binarios esperados.
- [x] 4. Normalizar `backend-perifericos` con `build:bin`, `pkg`, targets `node18-linux-x64`/`node18-win-x64`, outputPath `dist-bin` y binarios esperados.
- [x] 5. Revisar `api` y `backend-reporteria`; confirmar cumplimiento y remover `.env*` de `pkg.assets` como ajuste minimo de seguridad.
- [x] 6. Documentar convencion segura de `.env.example`, `.env` real fuera de git y runtime env fuera del binario o junto al binario segun diseno actual.
- [x] 7. Crear scripts opcionales `scripts/build/build-all-backends.sh` y `scripts/build/verify-backend-binaries.sh` sin deploy ni AWS.
- [x] 8. Crear `docs/evidencia-binarios-unificados-mvp-00-7B.md`.
- [x] 9. Ejecutar validaciones locales permitidas y registrar resultado.
- [x] 10. Confirmar que no se ejecuto deploy, no se toco AWS, no se modificaron secretos, no se reinicio PM2, no se subieron binarios, no se cambiaron endpoints y no se toco base de datos.

## MVP-00.7C - PM2 ecosystem unificado

Estado: `QA_PM2_ECOSYSTEM_READY`.

- [x] 1. Usar `docs/evidencia-binarios-unificados-mvp-00-7B.md` como base de binarios esperados.
- [x] 2. Crear archivo versionado `scripts/pm2/ecosystem.qa.config.js`.
- [x] 3. Definir apps PM2 `api-linux`, `backend-reporteria-linux`, `backend-facturacion-electronica-linux` y `backend-perifericos-linux`.
- [x] 4. Definir por app `cwd`, script binario Linux, `interpreter: "none"`, `exec_mode: "fork"`, `instances: 1`, `autorestart`, `max_restarts`, `restart_delay`, logs separados, `merge_logs: false` y env QA con puerto correspondiente.
- [x] 5. Confirmar que el ecosystem no incluye secretos DB/JWT/tokens y que los secretos deben vivir en `.env` runtime por carpeta `build-*`.
- [x] 6. Crear `docs/evidencia-pm2-ecosystem-unificado-mvp-00-7C.md`.
- [x] 7. Documentar comandos manuales para `pm2 start`, reload, restart por servicio, `pm2 save`, logs y rollback.
- [x] 8. Ejecutar validaciones locales permitidas y registrar resultado.
- [x] 9. Confirmar que no se ejecuto PM2, no se toco AWS, no se hizo deploy, no se modificaron secretos, no se subieron binarios y no se reiniciaron procesos.

## MVP-00.7D - GitHub Actions Deploy QA

Estado: `QA_GITHUB_ACTIONS_DEPLOY_READY`.

- [x] 1. Revisar endpoints health reales de `backend-facturacion-electronica` y `backend-perifericos`.
- [x] 2. Confirmar endpoints smoke reales: `backend-facturacion-electronica` usa `GET /health` en `4022`; `backend-perifericos` usa `GET /health` en `4023` y escucha local.
- [x] 3. Crear workflow `.github/workflows/deploy-qa-backends.yml` con trigger `push` a `release/evolutivo/0.0.1` y `workflow_dispatch`.
- [x] 4. Definir job `build` con checkout, Node 20, `npm ci`, `npm run build:bin` por backend, verificacion de binarios Linux, empaquetado y upload artifact.
- [x] 5. Definir job `deploy` dependiente de `build`, condicionado a rama QA o `workflow_dispatch`, con secrets requeridos sin valores reales.
- [x] 6. Crear script remoto `scripts/deploy/qa-deploy-backends.sh` para staging, backup, reemplazo seguro, `chmod +x`, PM2 startOrReload controlado y smoke local opcional sin tocar `.env`.
- [x] 7. Documentar smoke publico y local: API/reporteria publicos, facturacion/perifericos locales por SSH con endpoint real detectado.
- [x] 8. Documentar rollback manual no automatico destructivo.
- [x] 9. Crear `docs/evidencia-github-actions-deploy-qa-mvp-00-7D.md`.
- [x] 10. Ejecutar validaciones locales permitidas y registrar resultado.
- [x] 11. Confirmar que no se ejecuto deploy real, no se crearon secrets reales, no se toco AWS, no se reinicio PM2, no se subieron binarios y no se expusieron secretos.

## MVP-00.7D-FIX1 - Fix backend-perifericos missing LogsService

Estado: `QA_BACKEND_PERIFERICOS_LOGS_SERVICE_FIXED`.

- [x] 1. Revisar `backend-perifericos/src/modules/logs`.
- [x] 2. Confirmar que `LogsService`, `LogsModule` y `LogsController` existen localmente.
- [x] 3. Identificar causa de fallo Linux/GitHub Actions: `.gitignore` ignoraba el directorio fuente `backend-perifericos/src/modules/logs/`.
- [x] 4. Alinear versionado con casing exacto Linux para `../logs/logs.service`.
- [x] 5. Verificar metodos usados por scanner/devices/scale/printer/cash-drawer/tests: `append`, `list`, `getLimit`.
- [x] 6. Agregar excepcion segura en `.gitignore` para versionar `backend-perifericos/src/modules/logs/**` sin versionar logs runtime.
- [x] 7. Ejecutar `npm run build` en `backend-perifericos`.
- [x] 8. Ejecutar `npm run build:bin` en `backend-perifericos`.
- [x] 9. Ejecutar `bash scripts/build/verify-backend-binaries.sh`.
- [x] 10. Crear `docs/evidencia-fix-backend-perifericos-logs-service-mvp-00-7D-fix1.md`.
- [x] 11. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 12. Ejecutar `git diff --check`.
- [x] 13. Ejecutar `git status --short`.
- [x] 14. Confirmar que no se ejecuto deploy, no se toco AWS, no se modificaron secrets y no se reinicio PM2.

## MVP-00.7D-FIX2 - Add deploy smoke retry

Estado: `QA_DEPLOY_SMOKE_RETRY_READY`.

- [x] 1. Revisar fallo de smoke inmediato posterior a `pm2 startOrReload`.
- [x] 2. Agregar funcion `wait_for_http` en `scripts/deploy/qa-deploy-backends.sh`.
- [x] 3. Definir retry/backoff con 30 intentos y 2 segundos entre intentos.
- [x] 4. Usar `curl -fsS`, imprimir intento actual y fallar solo despues del ultimo intento.
- [x] 5. Reemplazar smoke directo por `wait_for_http` para `http://127.0.0.1:4020/api/system/version`.
- [x] 6. Reemplazar smoke directo por `wait_for_http` para `http://127.0.0.1:4021/api/reports/health`.
- [x] 7. Reemplazar smoke directo por `wait_for_http` para `http://127.0.0.1:4022/health`.
- [x] 8. Reemplazar smoke directo por `wait_for_http` para `http://127.0.0.1:4023/health`.
- [x] 9. Mantener `RUN_LOCAL_SMOKE=YES/NO`.
- [x] 10. Ejecutar `bash -n scripts/deploy/qa-deploy-backends.sh`.
- [x] 11. Crear `docs/evidencia-deploy-smoke-retry-mvp-00-7D-fix2.md`.
- [x] 12. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 13. Ejecutar `git diff --check`.
- [x] 14. Ejecutar `git status --short`.
- [x] 15. Confirmar que no se ejecuto deploy, no se toco AWS, no se modificaron secrets y no se tocaron binarios.

## MVP-00.7E - QA Runtime + GitHub Secrets Checklist

Estado: `QA_RUNTIME_GITHUB_SECRETS_CHECKLIST_READY`.

- [x] 1. Crear checklist de GitHub Secrets requeridos: `QA_SSH_HOST`, `QA_SSH_USER`, `QA_SSH_PRIVATE_KEY`, `QA_DEPLOY_BASE_PATH`, `QA_API_BASE_URL`.
- [x] 2. Documentar valores esperados sin secretos: `QA_DEPLOY_BASE_PATH=/home/ubuntu/manustienda`, `QA_API_BASE_URL=https://api.apptiendamanus.space`, `QA_SSH_USER=ubuntu`, `QA_SSH_HOST=<host o ip QA>`.
- [x] 3. Crear checklist runtime AWS para carpetas `build`, `build-reporteria`, `build-facturacion-electronica`, `build-perifericos`, logs por servicio y backups por deploy.
- [x] 4. Crear checklist `.env` runtime para API, reportería, facturación electrónica y periféricos sin versionar ni sobrescribir `.env` reales.
- [x] 5. Documentar que API y reportería deben apuntar a `manus_tienda_qa`.
- [x] 6. Crear checklist PM2 con `ecosystem.qa.config.js` y procesos esperados.
- [x] 7. Crear checklist puertos `4020`, `4021`, `4022`, `4023` y nota de FE/perifericos solo localhost si Nginx no expone.
- [x] 8. Crear checklist smoke para `/api/system/version`, `/api/reports/health`, `http://127.0.0.1:4022/health` y `http://127.0.0.1:4023/health`.
- [x] 9. Crear `docs/checklist-qa-runtime-github-secrets-mvp-00-7E.md`.
- [x] 10. Crear `docs/evidencia-qa-runtime-github-secrets-checklist-mvp-00-7E.md`.
- [x] 11. Ejecutar validaciones locales permitidas y registrar resultado.
- [x] 12. Confirmar que no se ejecuto deploy, no se toco AWS, no se crearon secrets reales, no se imprimieron secretos, no se reinicio PM2, no se modificaron binarios y no se modificaron `.env` reales.

## MVP-00.7F - Controlled QA Deploy Runbook

Estado: `QA_CONTROLLED_DEPLOY_RUNBOOK_READY`.

- [x] 1. Crear runbook para primer deploy QA controlado via `workflow_dispatch`.
- [x] 2. Incluir checklist pre-merge.
- [x] 3. Documentar merge de feature branch a `develop` sin ejecutarlo.
- [x] 4. Documentar merge de `develop` a `release/evolutivo/0.0.1` sin ejecutarlo.
- [x] 5. Documentar creacion/verificacion de GitHub secrets sin crear secrets reales.
- [x] 6. Documentar preparacion runtime AWS sin tocar AWS.
- [x] 7. Documentar validacion `.env` sin leer ni modificar `.env` reales.
- [x] 8. Documentar ejecucion manual de `workflow_dispatch`.
- [x] 9. Documentar validacion de GitHub Actions, PM2, smoke tests y rollback manual.
- [x] 10. Crear `docs/runbook-controlled-qa-deploy-mvp-00-7F.md`.
- [x] 11. Crear evidencia `docs/evidencia-controlled-qa-deploy-runbook-mvp-00-7F.md`.
- [x] 12. Ejecutar validaciones locales permitidas y registrar resultado.
- [x] 13. Confirmar que no se ejecuto deploy, no se toco AWS y no se crearon secrets reales.

## MVP-01 - QA Operativo Integral

- [ ] 1. Definir ambiente QA local/controlado y datos representativos.
- [ ] 2. Validar login, roles y permisos para roles MVP.
- [ ] 3. Validar flujo POS con venta efectiva.
- [ ] 4. Validar venta con pago no efectivo.
- [ ] 5. Validar cancelacion/anulacion de venta si aplica.
- [ ] 6. Validar compras contado, credito, parcial y recepcion.
- [ ] 7. Validar pedidos pendientes, parciales, completados y cancelados.
- [ ] 8. Validar inventario, productos, unidades, impuestos, lotes y stock.
- [ ] 9. Validar clientes y proveedores operativos.
- [ ] 10. Validar caja: apertura, cierre, movimientos, pagos y egresos.
- [ ] 11. Validar reportería existente por modulo.
- [ ] 12. Validar multisucursal y multiusuario si el ambiente lo permite.
- [ ] 13. Validar perifericos MOCK no bloquean negocio.
- [ ] 14. Corregir bugs reales encontrados con cambios minimos.
- [ ] 15. Crear `docs/evidencia-qa-operativo-integral-mvp-01.md`.
- [ ] 16. Ejecutar build/test/OpenSpec/git checks.

## MVP-01.1 - QA Autenticacion, Roles, Menus y Terminales

Estado: `QA_OPERATIVO_AUTH_RBAC_TERMINALES_BLOCKED_LOCAL_HEALTH`.

- [x] 1. Crear plan QA para `SUPER_ADMIN`, `SUPER_USER`, `ADMIN` y `USER`.
- [x] 2. Validar `GET /api/system/version` en QA AWS.
- [x] 3. Validar `GET /api/reports/health` en QA AWS.
- [ ] 4. Validar `GET http://127.0.0.1:4022/health` en QA AWS.
- [ ] 5. Validar `GET http://127.0.0.1:4023/health` en QA AWS.
- [x] 6. Validar login por rol sin exponer tokens ni credenciales.
- [x] 7. Validar menu visible por rol.
- [x] 8. Validar permisos base por rol: `SUPER_ADMIN` global, `SUPER_USER` tenant, `ADMIN` sucursal y `USER` operativo.
- [x] 9. Validar terminal POS con `GET /api/pos-terminals/resolve-current`, `GET /api/pos-terminals` y `GET /api/pos-terminals/:id/peripherals`.
- [x] 10. Validar configuracion de terminal/perifericos en `MOCK` por API.
- [ ] 11. Validar `backend-perifericos` health directo `mode=MOCK`.
- [ ] 12. Validar PM2 health actual.
- [x] 13. Crear `docs/evidencia-qa-operativo-integral-mvp-01-1.md`.
- [x] 14. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 15. Ejecutar `git diff --check`.
- [x] 16. Ejecutar `git status --short`.
- [x] 17. Confirmar que no se modifico codigo, no se ejecutaron migraciones, no se hizo deploy, no se reinicio PM2 y no se expusieron secretos.

## MVP-01.2 - QA Clientes FE, Proveedores FE y Productos

Estado: `QA_OPERATIVO_CLIENTES_PROVEEDORES_PRODUCTOS_READY`.

- [x] 1. Validar login/contexto QA con `SUPER_ADMIN` sin exponer token ni password.
- [x] 2. Validar Clientes FE: listado, creacion, edicion, consulta por id, campos FE y persistencia.
- [x] 3. Validar cliente consumidor final activo.
  - Rerun 2026-06-11: `GET /api/electronic-invoicing/customers/default` HTTP 200 y `POST /api/electronic-invoicing/customers/default/ensure` HTTP 201.
- [x] 4. Validar Lookup Clientes FE endpoint y apply lookup con persistencia de `dianLastLookupStatus`/`dianLastLookupAt`.
- [ ] 5. Validar Lookup Clientes FE escenarios `FOUND` y `NOT_FOUND`.
  - Bloqueado: QA responde `provider=NONE`, `mode=disabled`, `lookupStatus=SKIPPED`.
- [x] 6. Validar Proveedores FE: listado, creacion, edicion, consulta por id, campos FE y persistencia.
- [x] 7. Validar Lookup Proveedores FE endpoint y apply lookup con persistencia de `fiscalLastLookupStatus`/`fiscalLastLookupAt`.
- [ ] 8. Validar Lookup Proveedores FE escenarios `FOUND` y `NOT_FOUND`.
  - Bloqueado: QA responde `provider=NONE`, `mode=disabled`, `lookupStatus=SKIPPED`.
- [x] 9. Validar Productos: listado, creacion, edicion, consulta, SKU, barcode principal, barcode alterno, unidad, impuesto y activo con setup QA controlado.
- [x] 10. Validar Inventario loteado en modo solo lectura con `GET /api/inventory/lot-balances`.
- [x] 11. Validar lotes reales con fecha vencimiento, cantidad disponible y trazabilidad.
  - Rerun 2026-06-11: `QA-LOT-MVP-01-2B-001` visible via `GET /api/inventory/lot-balances`, `quantityAvailable=25`.
- [x] 12. Validar Impuestos: listado, setup QA controlado y asociacion producto.
- [x] 13. Validar impuestos activos base existentes.
  - Rerun 2026-06-11: `GET /api/taxes` devolvio `IVA 19%` y `Exento`.
- [x] 14. Validar Promociones: listado, creacion API controlada y preview pricing para porcentaje, monto fijo y precio especial.
- [ ] 15. Validar creacion de promociones desde UI.
  - No ejercitado en esta corrida; se valido API porque el alcance permitia creacion si UI disponible.
- [x] 16. Crear `docs/evidencia-qa-operativo-integral-mvp-01-2.md`.
- [x] 17. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 18. Ejecutar `git diff --check`.
- [x] 19. Ejecutar `git status --short`.
- [x] 20. Confirmar que no se modifico codigo, no se ejecutaron migraciones, no se toco PM2, no se hizo deploy, no se tocaron datos productivos y no se expusieron secretos.
- [x] 21. Re-ejecutar QA funcional MVP-01.2 post-bootstrap contra API QA publica.
  - Rerun 2026-06-11: PASS con `SUPER_ADMIN` seed, token no impreso.
- [x] 22. Validar `GET /api/electronic-invoicing/customers/default`.
  - Rerun 2026-06-11: HTTP 200, `isFinalConsumer=true`.
- [x] 23. Validar `POST /api/electronic-invoicing/customers/default/ensure`.
  - Rerun 2026-06-11: HTTP 201.
- [x] 24. Validar `units > 0`, `taxes > 0`, producto demo, lote demo, promociones, Clientes FE y Proveedores FE.
  - Rerun 2026-06-11: PASS. `units=4`, `taxes=2`, `QA-BASE-LOT-001` visible, `QA-LOT-MVP-01-2B-001` visible con `quantityAvailable=25`, promociones/pricing HTTP 200/201, Clientes FE y Proveedores FE HTTP 200.

## MVP-01.2A - QA Functional Seed & Config Remediation Plan

Estado: `QA_FUNCTIONAL_SEED_CONFIG_REMEDIATION_PLANNED`.

- [x] 1. Analizar `docs/evidencia-qa-operativo-integral-mvp-01-2.md`.
- [x] 2. Analizar por que `GET /api/electronic-invoicing/customers/default` devuelve HTTP 404 y `POST /api/electronic-invoicing/customers/default/ensure` devuelve HTTP 409.
- [x] 3. Determinar que el bloqueo de consumidor final es mismatch entre seed legacy `is_default` y endpoint FE `is_final_consumer`, no solo ausencia simple de seed.
- [x] 4. Analizar por que lookup FE queda `provider=NONE`, `mode=disabled`, `lookupStatus=SKIPPED`.
- [x] 5. Determinar config/env necesaria para lookup MOCK en QA: `DIAN_THIRD_PARTY_LOOKUP_ENABLED=true`, `DIAN_THIRD_PARTY_LOOKUP_MODE=mock`, `DIAN_GET_ACQUIRER_HTTP_ENABLED=false`.
- [x] 6. Analizar por que `units=0` y `taxes=0` en `manus_tienda_qa`.
- [x] 7. Determinar que seeds de unidades/impuestos existen pero no estan incluidos en `scripts/database/migrate_prd.sh`.
- [x] 8. Definir seed QA minimo para unidades, impuestos, consumidor final, producto base, proveedor base, cliente FE base y lote demo controlado.
- [x] 9. Definir datos bootstrap obligatorios vs fixtures QA opcionales.
- [x] 10. Proponer migraciones/seeds versionados, idempotentes y seguros sin implementarlos.
- [x] 11. Crear `docs/evidencia-qa-functional-seed-config-remediation-plan-mvp-01-2A.md`.
- [x] 12. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 13. Ejecutar `git diff --check`.
- [x] 14. Ejecutar `git status --short`.
- [x] 15. Confirmar que no se ejecutaron migraciones, no se toco AWS, no se modifico DB, no se hizo deploy y no se corrigio codigo.

## MVP-01.2B - Implement QA Functional Seeds + FE Mock Config

Estado: `QA_FUNCTIONAL_SEED_CONFIG_IMPLEMENTED`.

- [x] 1. Analizar `docs/evidencia-qa-operativo-integral-mvp-01-2.md`.
- [x] 2. Analizar `docs/evidencia-qa-functional-seed-config-remediation-plan-mvp-01-2A.md`.
- [x] 3. Crear `scripts/database/migrations/V058__qa_required_catalog_seed.sql` para normalizar consumidor final FE/default.
- [x] 4. Garantizar idempotencia de consumidor final sin romper `ux_customers_tenant_default`.
- [x] 5. Incluir `products/2026_04_25_seed_inventory_units.sql` en `scripts/database/migrate_prd.sh`.
- [x] 6. Incluir `products/2026_04_25_seed_inventory_taxes.sql` en `scripts/database/migrate_prd.sh`.
- [x] 7. Confirmar que payment methods ya aplican por `sale/004_sale_payment_methods.sql` y no requieren catalogo adicional.
- [x] 8. Crear `scripts/database/migrations/20260611_mvp_01_2b_functional_qa_fixtures.sql` para producto demo, proveedor demo, cliente FE demo y lote demo.
- [x] 9. Registrar fixture QA funcional como opcional y gated por `RUN_OPTIONAL_QA_FIXTURES=YES` / `APPLY_OPTIONAL_FIXTURES=YES`.
- [x] 10. Documentar lookup MOCK en `api/.env.example` sin modificar `.env` real.
- [x] 11. Documentar lookup MOCK en `backend-facturacion-electronica/.env.example` sin modificar `.env` real.
- [x] 12. Actualizar `scripts/database/bootstrap-manus-tienda-qa.manifest.md`.
- [x] 13. Actualizar runbooks de bootstrap QA.
- [x] 14. Crear `docs/evidencia-qa-functional-seeds-fe-mock-implementation-mvp-01-2B.md`.
- [x] 15. Ejecutar `bash -n scripts/database/migrate_prd.sh`.
- [x] 16. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 17. Ejecutar `git diff --check`.
- [x] 18. Ejecutar `git status --short`.
- [x] 19. Confirmar que no se ejecuto bootstrap, no se migró, no se toco AWS, no se modifico DB real, no se hizo deploy, no se reinicio PM2 y no se agregaron secretos.

## MVP-01.2B-FIX1 - Repair V058 SQL syntax

Estado: `QA_V058_SQL_FIXED`.

- [x] 1. Revisar `scripts/database/migrations/V058__qa_required_catalog_seed.sql`.
- [x] 2. Encontrar error exacto alrededor de la linea reportada.
- [x] 3. Confirmar que el `CREATE TEMP TABLE ... AS WITH candidates AS (...)` no consumia el CTE con `SELECT`.
- [x] 4. Corregir V058 para PostgreSQL 16 agregando `SELECT * FROM candidates`.
- [x] 5. Validar `INSERT` de consumidor final, units y taxes por revision estatica.
- [x] 6. Validar CTE, parentesis y cierre del statement por revision estatica.
- [x] 7. Validar que V058 no usa `ON CONFLICT` y mantiene idempotencia con `NOT EXISTS`.
- [x] 8. Validar `DO` blocks por revision estatica.
- [x] 9. Validar columnas `units.is_active`, `taxes.is_active` y `customers.is_default`.
- [x] 10. Crear `docs/evidencia-fix-v058-bootstrap-syntax-mvp-01-2B-fix1.md`.
- [x] 11. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 12. Ejecutar `git diff --check`.
- [x] 13. Ejecutar `git status --short`.
- [x] 14. Confirmar que no se ejecuto bootstrap, no se ejecutaron migraciones, no se toco AWS, no se toco DB, no se hizo deploy y no se toco PM2.

## MVP-01.2B-FIX2 - Separate functional QA fixtures from legacy reporting fixtures

Estado: `QA_FUNCTIONAL_FIXTURES_ISOLATED`.

- [x] 1. Revisar `scripts/database/migrate_prd.sh`.
- [x] 2. Confirmar que `20260505_reporting_pos_fixtures.sql` y `20260611_mvp_01_2b_functional_qa_fixtures.sql` compartian la misma bandera opcional.
- [x] 3. Mantener `20260505_reporting_pos_fixtures.sql` fuera del flujo QA funcional.
- [x] 4. Crear bandera separada `RUN_REPORTING_QA_FIXTURES`.
- [x] 5. Mantener `RUN_OPTIONAL_QA_FIXTURES` para fixtures funcionales MVP-01.2.
- [x] 6. Mantener `APPLY_OPTIONAL_FIXTURES` como alias legacy de fixtures funcionales.
- [x] 7. Actualizar `scripts/database/bootstrap-manus-tienda-qa.sh` para validar, exportar y loguear `RUN_REPORTING_QA_FIXTURES`.
- [x] 8. Actualizar `scripts/database/bootstrap-manus-tienda-qa.manifest.md`.
- [x] 9. Actualizar runbooks de bootstrap QA.
- [x] 10. Actualizar `scripts/database/config/bootstrap-manus-tienda-qa.env.example`.
- [x] 11. Crear `docs/evidencia-fix-separate-functional-vs-reporting-fixtures-mvp-01-2B-fix2.md`.
- [x] 12. Ejecutar `bash -n scripts/database/migrate_prd.sh`.
- [x] 13. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 14. Ejecutar `git diff --check`.
- [x] 15. Confirmar que no se ejecuto bootstrap, no se ejecutaron migraciones, no se toco AWS, no se toco DB, no se hizo deploy y no se toco PM2.

## MVP-01.2C - Apply QA functional seeds and rerun QA

Estado: `QA_OPERATIVO_CLIENTES_PROVEEDORES_PRODUCTOS_BLOCKED`.

- [x] 1. Verificar que cambios de MVP-01.2B esten en branch feature `feat/develop/mvp-qa-operativo-integral`.
- [x] 2. Commit/push de cambios MVP-01.2B.
  - Commit: `0586656 feat: add QA functional seeds for MVP 01.2`.
- [x] 3. Merge feature -> `develop`.
  - `develop` actualizado a `0586656`.
- [x] 4. Merge `develop` -> `release/evolutivo/0.0.1`.
  - Merge commit: `e104bb0 Merge develop into release/evolutivo/0.0.1 for MVP 01.2C`.
- [x] 5. Confirmar GitHub Actions deploy success.
  - Run `27324821209`, workflow `Deploy QA Backends`, conclusion `success`.
- [x] 6. Validar endpoints publicos post-deploy.
  - `GET /api/system/version`: PASS.
  - `GET /api/reports/health`: PASS.
- [ ] 7. Validar release actualizada por SSH/runtime AWS.
  - Bloqueado: `ssh ubuntu@api.apptiendamanus.space` devuelve `Permission denied (publickey)`.
- [ ] 8. Crear backup previo de `manus_tienda_qa`: dump custom, PM2 list y runtime `.env` sin secretos.
  - Bloqueado: requiere SSH AWS valido.
- [ ] 9. Recrear solo `manus_tienda_qa`.
  - No ejecutado: prohibido sin backup previo.
- [ ] 10. Ajustar env bootstrap temporalmente con `CONFIRM_CREATE_QA_DB=YES` y `RUN_OPTIONAL_QA_FIXTURES=YES`.
  - No ejecutado: requiere shell AWS y backup previo.
- [ ] 11. Ejecutar `bash scripts/database/bootstrap-manus-tienda-qa.sh scripts/database/config/bootstrap-manus-tienda-qa.env`.
  - No ejecutado: requiere recreacion controlada de `manus_tienda_qa`.
- [ ] 12. Revertir confirmacion de env bootstrap.
  - No ejecutado: env remoto no fue modificado.
- [ ] 13. Validar SQL post-bootstrap: `units`, `taxes`, consumidor final unico/default, producto demo, lote demo y `migrations_history` con `V058`.
  - Bloqueado: requiere DB bootstrap aplicada.
- [ ] 14. Validar FE mock env runtime.
  - Bloqueado: requiere SSH AWS o evidencia runtime sanitizada.
- [ ] 15. Re-ejecutar QA MVP-01.2 completo.
  - Bloqueado: no se aplicaron seeds por falta de backup/SSH.
- [x] 16. Crear `docs/evidencia-qa-functional-seeds-apply-rerun-mvp-01-2C.md`.
- [x] 17. Ejecutar `openspec validate`, `git diff --check` y `git status --short`.
- [x] 18. Confirmar que no se toco `manus_tienda`, no se toco PRD, no se ejecuto sin backup previo, no se expusieron secretos y no se modificaron datos fuera de `manus_tienda_qa`.

## MVP-01.2C-FIX1 - Version app runtime DB grants for QA bootstrap

Estado: `QA_RUNTIME_DB_GRANTS_VERSIONED`.

- [x] 1. Revisar `scripts/database/migrate_prd.sh`.
- [x] 2. Revisar `scripts/database/bootstrap-manus-tienda-qa.sh`.
- [x] 3. Identificar variable runtime user inicial con fallback `DB_USER`; corregido en `MVP-01.2C-FIX2`.
- [x] 4. Crear `scripts/database/012_runtime_db_grants.sql`.
- [x] 5. Versionar `GRANT CONNECT ON DATABASE`.
- [x] 6. Versionar `GRANT USAGE ON SCHEMA public`.
- [x] 7. Versionar grants sobre tablas, secuencias y funciones existentes.
- [x] 8. Versionar `ALTER DEFAULT PRIVILEGES` para tablas, secuencias y funciones futuras.
- [x] 9. Incluir grants runtime al final de `scripts/database/migrate_prd.sh`.
- [x] 10. Exportar y loguear `DB_RUNTIME_USER` desde `scripts/database/bootstrap-manus-tienda-qa.sh`.
- [x] 11. Documentar `DB_RUNTIME_USER=manus_user` en env example.
- [x] 12. Actualizar runbooks y manifest.
- [x] 13. Crear `docs/evidencia-runtime-db-grants-bootstrap-mvp-01-2C-fix1.md`.
- [x] 14. Ejecutar `bash -n scripts/database/migrate_prd.sh`.
- [x] 15. Ejecutar `bash -n scripts/database/bootstrap-manus-tienda-qa.sh`.
- [x] 16. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 17. Ejecutar `git diff --check`.
- [x] 18. Confirmar que no se ejecuto bootstrap, no se ejecutaron migraciones, no se toco AWS, no se modifico DB, no se hizo deploy y no se tocaron secretos.

## MVP-01.2C-FIX2 - Runtime grants target wrong user

Estado: `QA_RUNTIME_GRANTS_TARGET_USER_FIXED`.

- [x] 1. Revisar `scripts/database/bootstrap-manus-tienda-qa.sh`.
- [x] 2. Revisar `scripts/database/migrate_prd.sh`.
- [x] 3. Revisar `scripts/database/012_runtime_db_grants.sql`.
- [x] 4. Determinar que `DB_RUNTIME_USER` resolvia a `manus_qa_user` por fallback a `DB_USER`, derivado de `DB_OWNER`.
- [x] 5. Cambiar prioridad a `APP_DB_USER`, `DB_RUNTIME_USER`, `MANUS_RUNTIME_DB_USER`, fallback literal `manus_user`.
- [x] 6. Eliminar `DB_USER` como fallback runtime para grants QA.
- [x] 7. Loguear `DB_RUNTIME_USER_SOURCE` para diagnostico.
- [x] 8. Actualizar runbooks y env example.
- [x] 9. Crear `docs/evidencia-fix-runtime-grants-target-user-mvp-01-2C-fix2.md`.
- [x] 10. Ejecutar `bash -n scripts/database/migrate_prd.sh`.
- [x] 11. Ejecutar `bash -n scripts/database/bootstrap-manus-tienda-qa.sh`.
- [x] 12. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 13. Ejecutar `git diff --check`.
- [x] 14. Confirmar que no se ejecuto bootstrap, no se ejecutaron migraciones, no se toco AWS, no se modifico DB y no se hizo deploy.

## MVP-01.2C-RERUN - QA Clientes FE, Proveedores FE y Productos

Estado: `QA_OPERATIVO_CLIENTES_PROVEEDORES_PRODUCTOS_READY`.

- [x] 1. Re-ejecutar `GET /api/system/version`.
- [x] 2. Re-ejecutar `GET /api/reports/health`.
- [x] 3. Validar login QA con `SUPER_ADMIN` seed sin imprimir token ni secretos.
- [x] 4. Validar `GET /api/auth/me`, `GET /api/auth/context` y branch resuelta.
- [x] 5. Validar `GET /api/electronic-invoicing/customers/default`.
- [x] 6. Validar `POST /api/electronic-invoicing/customers/default/ensure`.
- [x] 7. Validar cliente FE fixture `QA Cliente FE Base`.
- [x] 8. Validar proveedor FE fixture `QA Proveedor FE Base`.
- [x] 9. Validar `GET /api/units` con `UND`, `KG`, `LT`, `CJ`.
- [x] 10. Validar `GET /api/taxes` con `IVA 19%` y `Exento`.
- [x] 11. Validar producto fixture `QA-BASE-LOT-001`.
- [x] 12. Validar promociones/pricing con `GET /api/pricing/promotions` y `POST /api/pricing/preview-line`.
- [x] 13. Validar lote fixture `QA-LOT-MVP-01-2B-001` y `quantityAvailable=25`.
- [x] 14. Actualizar `docs/evidencia-qa-operativo-integral-mvp-01-2.md`.
- [x] 15. Confirmar que no se modifico codigo, no se ejecutaron migraciones, no se ejecuto bootstrap, no se hizo deploy, no se reinicio PM2 y no se imprimieron secretos.

## MVP-01.3 - QA Compras, Pagos y Caja

Estado: `QA_OPERATIVO_COMPRAS_PAGOS_CAJA_BLOCKED`.

- [x] 1. Login QA con rol autorizado `SUPER_ADMIN` sin imprimir token ni secretos.
- [x] 2. Validar metodos de pago activos; no habia metodos activos, se creo por API `QA-CASH-MVP013-20260611161548`.
- [x] 3. Validar caja activa; no habia caja activa, se creo por API `QA-CJA-MVP013-20260611161548`.
- [x] 4. Validar sesion actual; no habia sesion abierta, se abrio sesion QA `d41b8a9b-c9f6-441e-ad44-fc6baa551e28`.
- [x] 5. Validar summary de caja abierta con `expectedAmount=100000`.
- [x] 6. Crear compra QA controlada `e822426b-19c7-4605-99bb-7336d0e4159a` con proveedor fixture `QA Proveedor FE Base`.
- [x] 7. Agregar item con producto/lote fixture `QA-BASE-LOT-001`.
- [x] 8. Validar recepcion parcial: compra quedo `PARTIAL`, `receivedQuantity=1`, `pendingQuantity=1`.
- [ ] 9. Validar liquidacion parcial: bloqueado por `PATCH /api/purchases/:id/settle-partial` con HTTP 500 y body vacio.
- [ ] 10. Validar pagos parcial y completo: no ejecutado para evitar pagos sobre compra no liquidada.
- [ ] 11. Validar recepcion total: no ejecutado despues del bloqueo principal.
- [x] 12. Validar movimientos de caja de apertura y cierre; sesion cerrada con diferencia `0`.
- [ ] 13. Validar movimientos de caja por pagos de compra: bloqueado por liquidacion parcial.
- [ ] 14. Validar cancelacion si esta permitida en QA: no ejecutado despues del bloqueo principal.
- [ ] 15. Validar reportes `cash closings`, `purchases report` y `purchase ticket`: bloqueados con HTTP 500 y body vacio.
- [x] 16. Cleanup permitido: cierre de sesion QA `d41b8a9b-c9f6-441e-ad44-fc6baa551e28`.
- [x] 17. Crear `docs/evidencia-qa-operativo-integral-mvp-01-3.md`.
- [x] 18. Confirmar que no se modifico codigo, no se ejecutaron migraciones, no se hizo deploy, no se reinicio PM2, no se hicieron escrituras directas en DB y no se imprimieron secretos.

## MVP-01.3X - QA Operativo Integral End-to-End

Estado: `QA_OPERATIVO_END_TO_END_BLOCKED`.

- [x] 1. Ejecutar QA autenticado con rol `SUPER_ADMIN` sin documentar tokens ni secretos.
- [x] 2. Validar Web QA publica y login route.
- [x] 3. Validar health/version API.
- [x] 4. Validar metodos de pago y caja.
- [x] 5. Abrir sesion de caja QA si no existe.
- [x] 6. Validar compra total, recepcion total, pago parcial y pago completo.
- [x] 7. Validar compra parcial y confirmar bloqueo en liquidacion parcial.
- [x] 8. Validar cancelacion de compra draft.
- [x] 9. Validar pedido, confirmacion, entrega e invoice.
- [x] 10. Validar POS session y venta POS directa.
- [x] 11. Validar promociones/pricing.
- [x] 12. Validar Facturacion Electronica: consumidor final, ensure, clientes, proveedores y lookup degradado.
- [x] 13. Validar caja: movimientos, summary y cierre.
- [x] 14. Validar perifericos MOCK por settings de `posTerminalId`.
- [x] 15. Intentar health publico/local de `backend-perifericos` sin PM2 ni deploy.
- [x] 16. Validar reporteria de compras, caja, ventas, pedidos y clientes.
- [x] 17. Clasificar hallazgos P0/P1/P2.
- [x] 18. Crear `docs/evidencia-qa-operativo-integral-end-to-end-mvp-01-3x.md`.
- [x] 19. Confirmar que no se corrigio codigo, no se ejecutaron migraciones, no se hizo deploy, no se reinicio PM2, no se hicieron escrituras directas en DB, no se toco `manus_tienda` y no se documentaron secretos.
- [x] 20. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 21. Ejecutar `git diff --check`.
- [x] 22. Ejecutar `git status --short`.

## MVP-01.4X - Fix P0/P1 QA blockers batch

Estado: `QA_P0_P1_BLOCKERS_FIXED`.

- [x] 1. Revisar evidencias `docs/evidencia-qa-operativo-integral-mvp-01-3.md` y `docs/evidencia-qa-operativo-integral-end-to-end-mvp-01-3x.md`.
- [x] 2. Reproducir por test local el riesgo de `settle-partial` con audit context no UUID.
- [x] 3. Identificar causa P0 probable: cast directo de `auditoria_eventos.datos_despues->>'terminalId'` / `branchId` a UUID.
- [x] 4. Corregir `PurchaseService` para castear audit context a UUID solo si cumple patron UUID.
- [x] 5. Agregar regresion `PurchaseService.settlePartialPurchase: tolera audit context con terminalId no UUID`.
- [x] 6. Diagnosticar P1 de reporteria: Bearer JWT invalido podia escapar como error crudo y producir HTTP 500 incluso en health.
- [x] 7. Corregir `backend-reporteria` para capturar errores de `jwt.verify`.
- [x] 8. Mantener modo QA/demo con actor mock controlado por `REPORTS_ALLOW_MOCK_AUTH`.
- [x] 9. Documentar `REPORTS_ALLOW_MOCK_AUTH=true` en `backend-reporteria/.env.example`.
- [x] 10. Agregar regresiones de `JwtAuthGuard` para JWT valido, Bearer invalido con mock permitido y Bearer invalido con mock deshabilitado.
- [x] 11. Confirmar que no se requirio migracion SQL nueva.
- [x] 12. Crear `docs/evidencia-fix-p0-p1-end-to-end-mvp-01-4x.md`.
- [x] 13. Ejecutar build en backends afectados.
- [x] 14. Ejecutar tests afectados.
- [x] 15. Ejecutar `openspec.cmd validate mvp-web-hardening --type change --strict`.
- [x] 16. Ejecutar `git diff --check`.
- [x] 17. Ejecutar `git status --short`.
- [x] 18. Confirmar que no se toco AWS, no se hizo deploy, no se ejecutaron migraciones contra QA, no se reinicio PM2, no se versionaron secretos y no se hicieron escrituras directas en DB.

## MVP-02 - Facturacion Electronica Hardening

- [ ] 1. Revisar estado actual de clientes FE.
- [ ] 2. Revisar estado actual de proveedores FE.
- [ ] 3. Revisar GetAcquirer y modo provider-agnostic.
- [ ] 4. Validar creacion/edicion de cliente fiscal.
- [ ] 5. Validar creacion/edicion de proveedor fiscal.
- [ ] 6. Validar consumidor final y cliente rapido fiscal en POS.
- [ ] 7. Validar errores controlados cuando fuente fiscal falla o esta desactivada.
- [ ] 8. Validar eventos y trazabilidad FE existentes.
- [ ] 9. Validar reportería o consultas FE existentes.
- [ ] 10. Corregir bugs FE reales con cambios minimos.
- [ ] 11. Crear `docs/evidencia-qa-facturacion-electronica-hardening-mvp-02.md`.
- [ ] 12. Ejecutar build/test/OpenSpec/git checks.

## MVP-03 - Reporteria Operativa

- [ ] 1. Inventariar reportes actuales en Web y API.
- [ ] 2. Validar reporte de compras.
- [ ] 3. Validar reporte de pedidos.
- [ ] 4. Validar reporte de clientes.
- [ ] 5. Validar reporte de proveedores si aplica.
- [ ] 6. Validar reporte de productos.
- [ ] 7. Validar reporte de inventario y stock.
- [ ] 8. Validar reporte de caja.
- [ ] 9. Validar reporte de rentabilidad o margen si existe.
- [ ] 10. Agregar endpoints/vistas MVP faltantes solo si estan dentro de alcance y no duplican logica.
- [ ] 11. Validar filtros por fecha, tenant, sucursal y estado.
- [ ] 12. Crear `docs/evidencia-qa-reporteria-operativa-mvp-03.md`.
- [ ] 13. Ejecutar build/test/OpenSpec/git checks.

## MVP-04 - Terminales POS Hardening

- [ ] 1. Revisar seleccion/resolucion de sucursal POS.
- [ ] 2. Revisar seleccion/resolucion de terminal POS.
- [ ] 3. Revisar caja activa requerida para venta.
- [ ] 4. Validar multiusuario sobre terminal/caja.
- [ ] 5. Validar fallback MOCK para perifericos.
- [ ] 6. Validar errores controlados de contexto incompleto.
- [ ] 7. Validar que ventas, compras, pedidos y perifericos MOCK siguen compilando.
- [ ] 8. Corregir bugs reales con cambios minimos.
- [ ] 9. Crear `docs/evidencia-qa-terminales-pos-hardening-mvp-04.md`.
- [ ] 10. Ejecutar build/test/OpenSpec/git checks.

## MVP-05 - Versionamiento y Release Management

- [ ] 1. Revisar endpoints/versionamiento actual.
- [ ] 2. Definir metadata MVP: version, release, build, commit opcional, ambiente y migraciones.
- [ ] 3. Exponer version en API si falta.
- [ ] 4. Mostrar version/release/build en UI si falta.
- [ ] 5. Validar estado de migraciones o version DB de forma segura.
- [ ] 6. Actualizar `.env.example` o README si aplica.
- [ ] 7. Crear checklist release MVP.
- [ ] 8. Crear `docs/evidencia-qa-versionamiento-release-mvp-05.md`.
- [ ] 9. Ejecutar build/test/OpenSpec/git checks.

## MVP-06 - Auditoria Operativa

- [ ] 1. Inventariar auditoría existente.
- [ ] 2. Definir eventos criticos MVP.
- [ ] 3. Validar auditoría para ventas.
- [ ] 4. Validar auditoría para compras.
- [ ] 5. Validar auditoría para pedidos.
- [ ] 6. Validar auditoría para caja.
- [ ] 7. Validar auditoría para inventario.
- [ ] 8. Validar auditoría para configuracion critica.
- [ ] 9. Implementar eventos faltantes solo si son imprescindibles para MVP.
- [ ] 10. Confirmar que no se registran secretos ni payloads sensibles.
- [ ] 11. Crear `docs/evidencia-qa-auditoria-operativa-mvp-06.md`.
- [ ] 12. Ejecutar build/test/OpenSpec/git checks.

## MVP-07 - Health Monitoring

- [ ] 1. Inventariar health checks actuales.
- [ ] 2. Validar health de API.
- [ ] 3. Validar health de DB.
- [ ] 4. Validar health/version de Web si aplica.
- [ ] 5. Validar health de `backend-perifericos` MOCK sin hardware real.
- [ ] 6. Validar degradacion controlada cuando dependencia falla.
- [ ] 7. Agregar endpoint/panel de monitoreo MVP si falta.
- [ ] 8. Documentar runbook soporte tecnico.
- [ ] 9. Crear `docs/evidencia-qa-health-monitoring-mvp-07.md`.
- [ ] 10. Ejecutar build/test/OpenSpec/git checks.

## MVP-08 - QA Final MVP

- [ ] 1. Crear checklist final MVP WEB.
- [ ] 2. Ejecutar QA operativo end-to-end autenticado.
- [ ] 3. Ejecutar QA multiusuario.
- [ ] 4. Ejecutar QA multisucursal.
- [ ] 5. Ejecutar QA facturacion electronica.
- [ ] 6. Ejecutar QA reportería.
- [ ] 7. Ejecutar QA caja/finanzas.
- [ ] 8. Ejecutar QA configuracion/terminales.
- [ ] 9. Ejecutar QA health/version/soporte.
- [ ] 10. Validar perifericos MOCK siguen funcionando.
- [ ] 11. Validar ausencia de hardware real y adapters reales.
- [ ] 12. Ejecutar `api` build/test.
- [ ] 13. Ejecutar `web` build.
- [ ] 14. Ejecutar `backend-perifericos` build/test.
- [ ] 15. Ejecutar OpenSpec validate.
- [ ] 16. Ejecutar `git diff --check`.
- [ ] 17. Ejecutar `git status --short`.
- [ ] 18. Crear `docs/evidencia-qa-final-mvp-web-mvp-08.md`.
- [ ] 19. Emitir `MVP_WEB_READY` o `MVP_WEB_BLOCKED`.

## Restricciones permanentes

- [ ] 1. No implementar impresora real.
- [ ] 2. No implementar scanner real.
- [ ] 3. No implementar balanza real.
- [ ] 4. No implementar caja real.
- [ ] 5. No activar `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- [ ] 6. No implementar Electron.
- [ ] 7. No implementar Capacitor.
- [ ] 8. No usar USB, serialport, HID ni drivers.
- [ ] 9. No modificar `backend-perifericos/` salvo bug real.
- [ ] 10. No modificar `add-pos-peripherals-platform` salvo bug real.
