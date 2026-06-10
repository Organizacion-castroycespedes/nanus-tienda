# Evidencia QA - Bootstrap manifest/env validation MVP-00.4.4

## Objetivo

Validar que el bootstrap futuro de `manus_tienda_qa` tenga archivo env externo preparado, manifiesto SQL cronologico y script seguro alineado al manifiesto.

## Alcance

- Solo documentacion y scripts de preparacion.
- No se ejecuto bootstrap.
- No se creo base real.
- No se ejecutaron migraciones.
- No se toco `manus_tienda`.
- No se toco PRD.

## Archivos revisados

- `scripts/database/config/bootstrap-manus-tienda-qa.env.example`
- `.gitignore`
- `scripts/database/bootstrap-manus-tienda-qa.sh`
- `scripts/database/seed.sh`
- `scripts/database/migrate_prd.sh`
- `docs/database-runbook.md`
- `docs/checklist-bootstrap-manus-tienda-qa.md`
- `openspec/changes/mvp-web-hardening/tasks.md`

## Archivos creados o actualizados

- Creado: `scripts/database/bootstrap-manus-tienda-qa.manifest.md`
- Creado: `docs/evidencia-qa-bootstrap-manifest-env-validation-mvp-00-4-4.md`
- Actualizado: `scripts/database/bootstrap-manus-tienda-qa.sh`
- Actualizado: `docs/checklist-bootstrap-manus-tienda-qa.md`
- Actualizado: `openspec/changes/mvp-web-hardening/tasks.md`

## Env example validado

`scripts/database/config/bootstrap-manus-tienda-qa.env.example` contiene:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=manus_tienda_qa
DB_OWNER=manus_qa_user
DB_ADMIN_USER=postgres
DB_ADMIN_PASSWORD=<set-outside-repo>
DB_APP_PASSWORD=<set-outside-repo>
CONFIRM_CREATE_QA_DB=NO
APPLY_OPTIONAL_FIXTURES=NO
RUN_SMOKE_SQL=YES
LOG_DIR=./logs
```

Tambien contiene variables placeholder para `ENVIRONMENT` y seed `SUPER_ADMIN`. No contiene secretos reales.

## `.gitignore` validado

Reglas confirmadas:

- `scripts/database/config/*.env`
- `!scripts/database/config/*.env.example`
- `!.env.example`

Resultado: el env real queda protegido y los ejemplos siguen versionables.

## Manifiesto creado

Ruta:

- `scripts/database/bootstrap-manus-tienda-qa.manifest.md`

Inventario:

- SQL encontrados: 113.
- SQL candidatos forward/bootstrap: 90.
- SQL excluidos por ser tests/dev/rollback/manual/draft: 23.

El manifiesto incluye:

- schema/base
- extensiones
- roles
- tenants/sucursales
- usuarios QA
- menu
- permisos/RBAC
- inventario
- compras
- pedidos
- ventas
- finanzas
- funciones
- migraciones incrementales
- `V053__products_sale_model_phase_11_1.sql`
- `V054__pos_terminal_peripheral_settings_phase_12.sql`
- consumidor final
- terminal POS default
- peripheral settings MOCK

## Orden propuesto

Orden ejecutable actual:

1. `scripts/database/bootstrap-manus-tienda-qa.sh`
2. Validacion de env externo y DB target.
3. Validacion del manifiesto.
4. Delegacion a `scripts/database/migrate_prd.sh`.
5. Aplicacion de schema/base y modulos historicos.
6. Aplicacion de funciones.
7. Aplicacion de `scripts/database/migrations/*.sql` ordenadas.
8. Seed minimo `011_prd_default_customer.sql`.
9. Fixtures opcionales solo si `APPLY_OPTIONAL_FIXTURES=YES`.
10. Smoke SQL solo si `RUN_SMOKE_SQL=YES`.

## Scripts relacionados

- `bootstrap-manus-tienda-qa.sh`: wrapper seguro. Requiere `CONFIRM_CREATE_QA_DB=YES`, `DB_NAME=manus_tienda_qa`, env externo y manifiesto.
- `migrate_prd.sh`: runner historico. El nombre es historico; para QA solo puede usarse de forma controlada mediante runbook y env QA.
- `seed.sh`: runner local/legado para seeds. No es el runner principal del bootstrap QA limpio.
- `docs/database-runbook.md`: runbook general DB.
- `docs/runbook-bootstrap-manus-tienda-qa.md`: runbook especifico para QA aislada.

## Script validado

`scripts/database/bootstrap-manus-tienda-qa.sh` fue revisado sin ejecutarlo.

Confirmado:

- no contiene passwords reales
- no contiene `DROP DATABASE`
- rechaza DB distinta a `manus_tienda_qa`
- requiere `CONFIRM_CREATE_QA_DB=YES`
- usa env externo
- usa `LOG_DIR`
- contempla `APPLY_OPTIONAL_FIXTURES`
- contempla `RUN_SMOKE_SQL`
- valida/imprime `scripts/database/bootstrap-manus-tienda-qa.manifest.md`
- no debe tocar `manus_tienda`

## Checklist actualizado

`docs/checklist-bootstrap-manus-tienda-qa.md` incluye seccion `Manifiesto SQL cronologico` con:

- ruta del manifiesto
- validacion de orden
- riesgos si falta un SQL
- confirmacion de V053/V054
- confirmacion de seeds minimos

## Riesgos pendientes

- No se ejecuto bootstrap real.
- No se valido contra PostgreSQL QA.
- `migrate_prd.sh` mantiene nombre historico y puede inducir error humano si se usa fuera del wrapper QA.
- `012_seed_electronic_invoicing_suppliers_menu_permissions.sql` esta inventariado, pero no incluido por el runner completo actual.
- Seeds demo de unidades/impuestos/productos/clientes/proveedores quedan inventariados; su uso debe ser decision explicita.

## Validaciones

- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS. Resultado: `Change 'mvp-web-hardening' is valid`.
- `git diff --check`: PASS con warning de fin de linea en `.gitignore`: `LF will be replaced by CRLF the next time Git touches it`.
- `git status --short`: PASS informativo. Hay cambios documentales y scripts de preparacion pendientes de commit.

## Resultado final

`QA_BOOTSTRAP_MANIFEST_READY`

## Restricciones cumplidas

- No bootstrap ejecutado.
- No DB creada.
- No migraciones ejecutadas.
- No `manus_tienda` tocada.
- No PRD tocado.
- No despliegue.
- No reinicio.
- No cambios de infraestructura.
