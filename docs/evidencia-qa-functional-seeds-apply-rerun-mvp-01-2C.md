# Evidencia QA functional seeds apply + rerun MVP-01.2C

Fecha: 2026-06-11 America/Bogota.

Cambio OpenSpec: `mvp-web-hardening`

Resultado: `QA_OPERATIVO_CLIENTES_PROVEEDORES_PRODUCTOS_BLOCKED`

## Objetivo

Preparar y ejecutar de forma controlada la aplicacion de seeds funcionales QA en AWS sobre `manus_tienda_qa`, con `RUN_OPTIONAL_QA_FIXTURES=YES`, y re-ejecutar QA funcional MVP-01.2.

## Restricciones cumplidas

- No se toco `manus_tienda`.
- No se toco PRD.
- No se ejecuto `DROP DATABASE`.
- No se ejecuto bootstrap.
- No se ejecutaron migraciones en AWS.
- No se modifico DB real.
- No se expusieron secretos.
- No se reinicio PM2 manualmente.

## Git y deploy

| Paso | Estado | Evidencia |
| --- | --- | --- |
| Verificar branch feature | PASS | Branch origen: `feat/develop/mvp-qa-operativo-integral`. |
| Commit MVP-01.2B | PASS | Commit local y remoto: `0586656 feat: add QA functional seeds for MVP 01.2`. |
| Push feature | PASS | `feat/develop/mvp-qa-operativo-integral` actualizado de `d948877` a `0586656`. |
| Merge feature -> develop | PASS | Fast-forward `develop` a `0586656`. |
| Push develop | PASS | `develop` actualizado de `d948877` a `0586656`. |
| Merge develop -> release | PASS | Merge commit `e104bb0 Merge develop into release/evolutivo/0.0.1 for MVP 01.2C`. |
| Push release | PASS | `release/evolutivo/0.0.1` actualizado de `d33289b` a `e104bb0`. |
| GitHub Actions deploy | PASS | Run `27324821209`, workflow `Deploy QA Backends`, status `completed`, conclusion `success`, head SHA `e104bb0a75beb7dac90373f21d20c8e9ee02df04`. |

## Validacion publica post-deploy

| Validacion | Estado | Resultado |
| --- | --- | --- |
| `GET https://api.apptiendamanus.space/api/system/version` | PASS | HTTP 200, `{"version":"0.0.1"}`. |
| `GET https://api.apptiendamanus.space/api/reports/health` | PASS | HTTP 200, `status=ok`, `service=backend-reporteria`. |
| `GET https://api.apptiendamanus.space/api/health` | INFO | HTTP 404 controlado: endpoint no existe. |

## Bloqueo AWS

La fase que requiere shell AWS quedo bloqueada por acceso SSH:

```text
ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$env:TEMP\aws_known_hosts_codex ubuntu@api.apptiendamanus.space hostname
ubuntu@api.apptiendamanus.space: Permission denied (publickey).
```

Este bloqueo impide ejecutar de forma verificable:

- backup previo `pg_dump -Fc` de `manus_tienda_qa`;
- backup PM2;
- backup runtime `.env` sanitizado;
- validacion release en filesystem/runtime AWS;
- terminacion de sesiones de `manus_tienda_qa`;
- `DROP DATABASE manus_tienda_qa`;
- `CREATE DATABASE manus_tienda_qa OWNER manus_qa_user`;
- preparacion de env temporal con `CONFIRM_CREATE_QA_DB=YES` y `RUN_OPTIONAL_QA_FIXTURES=YES`;
- bootstrap `bash scripts/database/bootstrap-manus-tienda-qa.sh scripts/database/config/bootstrap-manus-tienda-qa.env`;
- revertir flags de seguridad;
- validacion SQL post-bootstrap;
- validacion runtime FE MOCK en `.env` real;
- re-ejecucion completa de MVP-01.2 sobre DB limpia con fixtures.

## Estado de aplicacion DB

| Item | Estado | Evidencia |
| --- | --- | --- |
| Backup previo de `manus_tienda_qa` | BLOCKED | Requiere SSH AWS. |
| Recrear solo `manus_tienda_qa` | NOT_RUN | No se ejecuta sin backup previo. |
| Bootstrap con fixtures | NOT_RUN | No se ejecuta sin recrear DB y env controlado. |
| SQL `COUNT units > 0` | BLOCKED | Requiere conexion DB AWS. |
| SQL `COUNT taxes > 0` | BLOCKED | Requiere conexion DB AWS. |
| Consumidor final unico/default | BLOCKED | Requiere conexion DB AWS. |
| Producto demo fixture | BLOCKED | Requiere bootstrap con `RUN_OPTIONAL_QA_FIXTURES=YES`. |
| Lote demo fixture | BLOCKED | Requiere bootstrap con `RUN_OPTIONAL_QA_FIXTURES=YES`. |
| `migrations_history` contiene `V058` | BLOCKED | Requiere conexion DB AWS post-bootstrap. |
| FE mock env runtime | BLOCKED | Requiere SSH AWS para inspeccion sanitizada o evidencia runtime. |

## QA MVP-01.2 rerun

No se re-ejecuto QA funcional completo porque la estrategia aprobada dependia de aplicar primero seeds sobre `manus_tienda_qa` limpia y con backup previo.

Ejecutar QA sin bootstrap no valida MVP-01.2C y podria repetir los bloqueos ya documentados en:

- `docs/evidencia-qa-operativo-integral-mvp-01-2.md`
- `docs/evidencia-qa-functional-seed-config-remediation-plan-mvp-01-2A.md`
- `docs/evidencia-qa-functional-seeds-fe-mock-implementation-mvp-01-2B.md`

## Validaciones locales

| Comando | Estado | Resultado |
| --- | --- | --- |
| `openspec.cmd validate mvp-web-hardening --type change --strict` | PASS | `Change 'mvp-web-hardening' is valid`. |
| `git diff --check` | PASS | Exit 0; warning LF/CRLF en `openspec/changes/mvp-web-hardening/tasks.md`. |
| `git status --short` | PASS | Muestra solo `openspec/changes/mvp-web-hardening/tasks.md` y esta evidencia nueva. |

## Decision

La parte Git/deploy quedo lista y desplegada. La parte DB/AWS queda bloqueada por falta de SSH valido para `ubuntu@api.apptiendamanus.space`.

Estado emitido:

```text
QA_OPERATIVO_CLIENTES_PROVEEDORES_PRODUCTOS_BLOCKED
```

Bloqueo exacto:

```text
AWS_SSH_PUBLICKEY_BLOCKED: ubuntu@api.apptiendamanus.space devuelve Permission denied (publickey), por lo que no se puede crear backup previo ni recrear manus_tienda_qa de forma segura.
```
