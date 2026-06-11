# Evidencia fix separate functional vs reporting fixtures MVP-01.2B-FIX2

Estado: `QA_FUNCTIONAL_FIXTURES_ISOLATED`.
Fecha: 2026-06-11.

## Alcance

- Archivo principal revisado: `scripts/database/migrate_prd.sh`.
- Objetivo: permitir ejecutar `20260611_mvp_01_2b_functional_qa_fixtures.sql` sin ejecutar `20260505_reporting_pos_fixtures.sql`.
- Restricciones respetadas: no AWS, no bootstrap, no migraciones, no DB, no deploy.

## Hallazgo

`migrate_prd.sh` tenia ambos fixtures dentro de una sola lista opcional:

- `20260505_reporting_pos_fixtures.sql`
- `20260611_mvp_01_2b_functional_qa_fixtures.sql`

Con `RUN_OPTIONAL_QA_FIXTURES=YES`, el runner intentaba aplicar ambos. Eso arrastraba el fixture legacy de reporting, que depende del usuario fijo `781912fe-5a32-483f-b99a-a931f9700913`.

## Cambio aplicado

- `RUN_OPTIONAL_QA_FIXTURES=YES` queda reservado para fixtures funcionales MVP-01.2.
- `APPLY_OPTIONAL_FIXTURES=YES` queda como alias legacy de `RUN_OPTIONAL_QA_FIXTURES=YES`.
- `RUN_REPORTING_QA_FIXTURES=YES` queda como bandera separada para el fixture reporting legacy.
- El flujo incremental forward sigue saltando ambos fixtures al recorrer `scripts/database/migrations/*.sql`.

## Matriz de ejecucion

| Bandera | Ejecuta fixture funcional MVP-01.2 | Ejecuta fixture reporting legacy |
| --- | --- | --- |
| Defaults | No | No |
| `RUN_OPTIONAL_QA_FIXTURES=YES` | Si | No |
| `APPLY_OPTIONAL_FIXTURES=YES` | Si | No |
| `RUN_REPORTING_QA_FIXTURES=YES` | No | Si |
| Ambas banderas en `YES` | Si | Si |

## Archivos actualizados

- `scripts/database/migrate_prd.sh`
- `scripts/database/bootstrap-manus-tienda-qa.sh`
- `scripts/database/bootstrap-manus-tienda-qa.manifest.md`
- `scripts/database/config/bootstrap-manus-tienda-qa.env.example`
- `docs/runbook-exec-bootstrap-manus-tienda-qa.md`
- `docs/runbook-bootstrap-manus-tienda-qa.md`
- `openspec/changes/mvp-web-hardening/tasks.md`

## Validaciones

- `bash -n scripts/database/migrate_prd.sh`: PASS.
- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS (`Change 'mvp-web-hardening' is valid`).
- `git diff --check`: PASS. Solo mostro warnings LF/CRLF de working copy.

## Resultado

`QA_FUNCTIONAL_FIXTURES_ISOLATED`
