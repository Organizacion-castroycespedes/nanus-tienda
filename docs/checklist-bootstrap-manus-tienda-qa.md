# Checklist Bootstrap `manus_tienda_qa`

Estado: checklist preparatorio. No ejecutar bootstrap sin aprobacion humana explicita.

## Seguridad

- [ ] Confirmar que no se tocara `manus_tienda`.
- [ ] Confirmar que no se tocara PRD.
- [ ] Confirmar que no se copiara data operativa.
- [ ] Confirmar que el archivo env real no esta versionado.
- [ ] Confirmar que no hay secretos en docs/OpenSpec.

## Backup previo

- [ ] Snapshot Lightsail creado.
- [ ] Snapshot etiquetado con fecha y responsable.
- [ ] Dump de `manus_tienda` creado si aplica.
- [ ] Backup Nginx creado si aplica.
- [ ] Backup PM2 creado si aplica.
- [ ] Backup `.env` creado fuera del repo si aplica.
- [ ] Rollback validado o documentado.

## Target QA

- [ ] `DB_NAME=manus_tienda_qa`.
- [ ] `DB_OWNER=manus_qa_user` o usuario aprobado.
- [ ] Password de app definido fuera del repo.
- [ ] Password admin definido fuera del repo.
- [ ] `ENVIRONMENT=qa`.
- [ ] `CONFIRM_CREATE_QA_DB=NO` mientras se prepara.
- [ ] `CONFIRM_CREATE_QA_DB=YES` solo durante la ejecucion aprobada.

## Migraciones y seeds

- [ ] Confirmar que `migrate_prd.sh` es el runner de bootstrap completo elegido.
- [ ] Confirmar que `V053__products_sale_model_phase_11_1.sql` esta incluida.
- [ ] Confirmar que `V054__pos_terminal_peripheral_settings_phase_12.sql` esta incluida.
- [ ] Confirmar seeds minimos de tenant/sucursal.
- [ ] Confirmar roles y permisos.
- [ ] Confirmar menu y `role_menu_permissions`.
- [ ] Confirmar usuario SUPER_ADMIN o SUPER_USER QA.
- [ ] Confirmar usuario ADMIN QA.
- [ ] Confirmar usuario USER QA si aplica.
- [ ] Confirmar cliente consumidor final.
- [ ] Confirmar metodos de pago base.
- [ ] Confirmar impuestos base si aplican.
- [ ] Confirmar unidades base si aplican.
- [ ] Confirmar terminal POS default.
- [ ] Confirmar peripheral settings default MOCK.

## Manifiesto SQL cronologico

- [ ] Confirmar ruta del manifiesto: `scripts/database/bootstrap-manus-tienda-qa.manifest.md`.
- [ ] Confirmar que el manifiesto lista el orden logico completo para DB limpia.
- [ ] Confirmar que el orden executable queda delegado a `scripts/database/bootstrap-manus-tienda-qa.sh`.
- [ ] Confirmar que `bootstrap-manus-tienda-qa.sh` valida la existencia del manifiesto antes de ejecutar.
- [ ] Confirmar que `migrate_prd.sh` conserva nombre historico y solo se usa para QA si el runbook lo permite.
- [ ] Confirmar que `V053__products_sale_model_phase_11_1.sql` esta en el manifiesto.
- [ ] Confirmar que `V054__pos_terminal_peripheral_settings_phase_12.sql` esta en el manifiesto.
- [ ] Confirmar seeds minimos: tenant/sucursal, roles, usuarios QA, menu, permisos/RBAC, consumidor final, metodos de pago, terminal POS y peripheral settings MOCK.
- [ ] Revisar riesgos si falta un SQL: bootstrap debe bloquearse y no debe tocar `manus_tienda_qa`.
- [ ] Revisar seeds inventariados pero no incluidos en runner actual antes de decidir incluir fixtures opcionales.

## Smoke SQL

- [ ] Validar `current_database() = manus_tienda_qa`.
- [ ] Validar `public.migrations_history`.
- [ ] Validar `public.tenants`.
- [ ] Validar `public.tenant_branches`.
- [ ] Validar `public.roles`.
- [ ] Validar `public.menu_items`.
- [ ] Validar `public.role_menu_permissions`.
- [ ] Validar `public.users`.
- [ ] Validar `public.pos_terminals`.
- [ ] Validar `public.pos_terminal_peripheral_settings`.

## Go / No-Go

- [ ] Owner QA aprueba.
- [ ] Ventana aprobada.
- [ ] Backup listo.
- [ ] Env real listo fuera del repo.
- [ ] Script revisado.
- [ ] Rollback listo.
- [ ] Resultado esperado: `QA_DB_BOOTSTRAP_READY_TO_RUN`.
