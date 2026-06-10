# Evidencia QA Database Bootstrap Strategy - MVP-00.4.2

Fecha: 2026-06-09

Cambio OpenSpec: `mvp-web-hardening`

Rama: `feat/develop/mvp-web-hardening`

Resultado: `QA_DATABASE_BOOTSTRAP_PLAN_READY`

## Objetivo

Diseñar y preparar el proceso para crear una base QA aislada llamada `manus_tienda_qa`, desde cero, con estructura/migraciones actuales y seeds minimos.

## Decision

Crear una DB nueva:

- `manus_tienda_qa`

No migrar datos operativos desde:

- `manus_tienda`

Usuario:

- recomendado: `manus_qa_user`;
- aceptable: `manus_user` solo si el responsable QA aprueba compartir owner.

## Por que no usar `manus_tienda`

- Puede ser ambiente compartido.
- Puede contener datos operativos o historicos no adecuados para QA MVP.
- Complica rollback.
- Aumenta riesgo de afectar datos existentes.
- Una DB limpia permite reproducibilidad y evidencia de migraciones desde cero.

## Scripts revisados

| Script | Uso identificado |
| --- | --- |
| `scripts/database/migrate.sh` | Runner historico/local. Crea DB y aplica archivos root `001_*.sql`, omite seeds por nombre. |
| `scripts/database/migrate_prd.sh` | Runner mas completo para bootstrap desde cero: crea rol/DB, schema, modulos, funciones, migraciones incrementales y seed minimo. |
| `scripts/database/run_migrations.sh` | Runner incremental para `scripts/database/migrations`. |
| `scripts/database/seed.sh` | Seeds generales, menu, roles, super admin, usuarios demo y role menu permissions. |
| `scripts/database/products/run_all.sh` | Modulos y fixtures de productos/inventario. Opcional para QA funcional. |
| `scripts/database/sale/run_sales_migrations.sh` | Modulo ventas. Ya incluido por `migrate_prd.sh`. |
| `scripts/database/finance/run_finance_migrations.sh` | Modulo finanzas/caja. Ya incluido por `migrate_prd.sh`. |
| `docs/database-runbook.md` | Runbook DB general y tabla `migrations_history`. |

## Orden propuesto

1. Backup/snapshot real segun MVP-00.4.
2. Archivo env externo con `DB_NAME=manus_tienda_qa`.
3. Confirmacion `CONFIRM_CREATE_QA_DB=YES`.
4. Crear rol/DB con runner.
5. Aplicar schema base.
6. Aplicar modulos productos, ventas, compras, pedidos y finanzas.
7. Aplicar funciones SQL.
8. Aplicar migraciones incrementales en orden.
9. Aplicar seed minimo de consumidor final.
10. Validar `migrations_history`.
11. Validar usuarios QA.
12. Validar tenant/sucursal.
13. Validar menus/permisos.
14. Validar terminal POS default y settings MOCK.
15. Ejecutar smoke SQL.

## Migraciones clave

| Migracion | Relevancia |
| --- | --- |
| `V053__products_sale_model_phase_11_1.sql` | Modelo formal `sale_type` y `measurement_unit`. |
| `V054__pos_terminal_peripheral_settings_phase_12.sql` | Terminal POS y peripheral settings MOCK. |

## Seeds minimos

Requeridos para arranque:

- `migrations_history`
- tenant base
- sucursal base
- roles
- menu
- permisos menu
- usuario `SUPER_ADMIN` o `SUPER_USER` QA
- usuario `ADMIN` QA
- usuario `USER` QA si aplica
- cliente `CONSUMIDOR FINAL`
- metodos de pago base
- impuestos base si el flujo lo requiere
- unidades base si el flujo lo requiere
- terminal POS default
- settings perifericos default MOCK

Nota:

- El runner `migrate_prd.sh` cubre el bootstrap mas completo actual.
- Fixtures de productos/inventario quedan opcionales para QA funcional, no obligatorios para DB limpia minima.

## Script seguro creado

Archivo:

- `scripts/database/bootstrap-manus-tienda-qa.sh`

Controles:

- exige `CONFIRM_CREATE_QA_DB=YES`;
- exige archivo env externo;
- rechaza example env;
- rechaza `DB_NAME` que no termine en `_qa`;
- restringe `DB_NAME` a `manus_tienda_qa`;
- rechaza `manus_tienda` y `manus_tienda_prd`;
- no contiene passwords;
- no ejecuta `DROP DATABASE`;
- registra logs;
- llama `migrate_prd.sh`;
- solo ejecuta fixtures opcionales si `RUN_OPTIONAL_QA_FIXTURES=YES`.

No ejecutado en esta fase.

## Rollback

Antes de bootstrap real:

- snapshot Lightsail;
- dump PostgreSQL de DBs existentes si comparten instancia;
- backup env/Nginx/PM2.

Si bootstrap falla:

- no borrar automaticamente;
- documentar error;
- revisar `migrations_history`;
- decidir manualmente si crear nuevo intento o limpiar DB fallida.

Si hay datos QA utiles:

- restaurar desde dump/snapshot;
- no hacer rollback manual parcial sin script revisado.

## Riesgos

- `manus_tienda` puede ser ambiente compartido.
- `migrate_prd.sh` se llama PRD, pero contiene el bootstrap completo del proyecto.
- Usuario `manus_user` puede compartir permisos; `manus_qa_user` aisla mejor.
- Fixtures opcionales pueden contaminar DB limpia.
- No hay rollback versionado para todas las migraciones.
- Sin backup/snapshot no se debe ejecutar bootstrap real.

## Siguiente paso

Fase futura recomendada:

- MVP-00.4.3: preparar env externo sanitizado y checklist final de ejecucion.

Solo despues:

- crear `manus_tienda_qa` con aprobacion humana explicita.

## Restricciones cumplidas

- No se ejecuto en AWS.
- No se creo DB real.
- No se corrieron migraciones reales.
- No se toco PRD.
- No se borro `manus_tienda`.
- No se modificaron datos existentes.
- No se expusieron credenciales.
- No se guardaron secretos.

## Validaciones de cierre

- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS (`Change 'mvp-web-hardening' is valid`)
- `git diff --check`: PASS
- `git status --short`: `?? docs/evidencia-qa-aws-deployment-plan-mvp-00-2.md`; `?? docs/evidencia-qa-aws-environment-readiness-mvp-00.md`; `?? docs/evidencia-qa-aws-precheck-dryrun-mvp-00-3.md`; `?? docs/evidencia-qa-backup-snapshot-readiness-mvp-00-4.md`; `?? docs/evidencia-qa-database-bootstrap-strategy-mvp-00-4-2.md`; `?? docs/runbook-bootstrap-manus-tienda-qa.md`; `?? openspec/changes/mvp-web-hardening/`; `?? scripts/database/bootstrap-manus-tienda-qa.sh`
