# Evidencia QA Bootstrap Env Checklist - MVP-00.4.3

Fecha: 2026-06-09

Cambio OpenSpec: `mvp-web-hardening`

Rama: `feat/develop/mvp-web-hardening`

Resultado: `QA_BOOTSTRAP_ENV_CHECKLIST_READY`

## Objetivo

Preparar la plantilla de configuracion externa no versionada y el checklist final para ejecutar, en una fase posterior, el bootstrap real de la base QA aislada `manus_tienda_qa`.

## Archivos creados

- `scripts/database/config/bootstrap-manus-tienda-qa.env.example`
- `docs/checklist-bootstrap-manus-tienda-qa.md`
- `docs/evidencia-qa-bootstrap-env-checklist-mvp-00-4-3.md`

## Archivos modificados

- `scripts/database/bootstrap-manus-tienda-qa.sh`
- `.gitignore`
- `openspec/changes/mvp-web-hardening/tasks.md`

## Variables definidas

Plantilla segura:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=manus_tienda_qa
DB_OWNER=manus_qa_user
DB_ADMIN_USER=postgres
DB_ADMIN_PASSWORD=<set-outside-repo>
DB_APP_PASSWORD=<set-outside-repo>
ENVIRONMENT=qa
SEED_SUPER_ADMIN_EMAIL=<set-outside-repo>
SEED_SUPER_ADMIN_PASSWORD=<set-outside-repo>
SEED_SUPER_ADMIN_FIRST_NAME=QA
SEED_SUPER_ADMIN_LAST_NAME=Admin
CONFIRM_CREATE_QA_DB=NO
APPLY_OPTIONAL_FIXTURES=NO
RUN_SMOKE_SQL=YES
LOG_DIR=./logs
```

## Regla de no secretos

- No guardar secretos en docs.
- No guardar secretos en OpenSpec.
- No commitear `scripts/database/config/*.env`.
- Mantener versionado solo `*.env.example`.
- El archivo real sugerido es `scripts/database/config/bootstrap-manus-tienda-qa.env` y debe quedarse fuera de git.

## Checklist creado

Archivo:

- `docs/checklist-bootstrap-manus-tienda-qa.md`

Incluye:

- snapshot Lightsail;
- dump de `manus_tienda` si aplica;
- target `manus_tienda_qa`;
- owner `manus_qa_user`;
- passwords fuera del repo;
- confirmacion de no tocar `manus_tienda`;
- `CONFIRM_CREATE_QA_DB=YES` solo al ejecutar;
- migraciones `V053` y `V054`;
- seeds minimos;
- smoke SQL;
- rollback;
- go/no-go.

## Revision del script

Script revisado:

- `scripts/database/bootstrap-manus-tienda-qa.sh`

Hallazgos y ajustes:

- La plantilla usa `DB_OWNER`; el script aceptaba `DB_USER`. Se agrego alias seguro `DB_USER=${DB_OWNER}`.
- La plantilla usa `DB_APP_PASSWORD`; el script aceptaba `DB_PASSWORD`. Se agrego alias seguro `DB_PASSWORD=${DB_APP_PASSWORD}`.
- La plantilla usa `APPLY_OPTIONAL_FIXTURES`; el script aceptaba `RUN_OPTIONAL_QA_FIXTURES`. Se agrego alias seguro.
- Se agrego `RUN_SMOKE_SQL=YES|NO`.
- Se agrego soporte para `LOG_DIR`.

Controles confirmados:

- exige `CONFIRM_CREATE_QA_DB=YES`;
- rechaza DB distinta a `manus_tienda_qa`;
- rechaza DB que no termina en `_qa`;
- no contiene passwords reales;
- usa archivo externo;
- no contiene `DROP DATABASE`;
- no toca `manus_tienda`;
- no se ejecuto en esta fase.

## Riesgos pendientes

- El archivo env real debe crearse manualmente fuera de git.
- No hay bootstrap real ejecutado todavia.
- `manus_tienda` no debe tocarse.
- `migrate_prd.sh` es el runner completo aunque su nombre diga PRD; se usa controlado por `DB_NAME=manus_tienda_qa`.
- No ejecutar sin backup/snapshot.
- Validar que `manus_qa_user` exista o pueda crearse.

## Siguiente fase recomendada

MVP-00.4.4: ejecucion controlada del backup/snapshot real y validacion del env externo.

No ejecutar bootstrap hasta tener aprobacion explicita, backup/snapshot y ventana controlada.

## Restricciones cumplidas

- No se creo DB real.
- No se ejecuto bootstrap.
- No se ejecutaron migraciones.
- No se toco `manus_tienda`.
- No se toco PRD.
- No se desplego.
- No se reinicio servidor.
- No se modifico infraestructura.
- No se guardaron secretos.

## Validaciones de cierre

- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS (`Change 'mvp-web-hardening' is valid`)
- `git diff --check`: PASS; Git informo warning de normalizacion CRLF en `.gitignore`, sin error de whitespace.
- `git status --short`: `.gitignore` modificado; nuevos docs/runbooks/OpenSpec/script/env example pendientes de track.
