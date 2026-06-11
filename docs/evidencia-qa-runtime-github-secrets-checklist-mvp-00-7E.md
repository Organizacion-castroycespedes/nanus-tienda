# Evidencia - QA Runtime + GitHub Secrets Checklist - MVP-00.7E

Fecha: 2026-06-10

Cambio OpenSpec: `mvp-web-hardening`

Fase: `MVP-00.7E - QA Runtime + GitHub Secrets Checklist`

Resultado: `QA_RUNTIME_GITHUB_SECRETS_CHECKLIST_READY`

## Objetivo

Preparar checklist final para ejecutar el primer deploy QA por `workflow_dispatch` de forma segura.

Contexto usado:

- `.github/workflows/deploy-qa-backends.yml`
- `scripts/deploy/qa-deploy-backends.sh`
- `scripts/pm2/ecosystem.qa.config.js`
- `docs/evidencia-github-actions-deploy-qa-mvp-00-7D.md`

Esta fase no ejecuta deploy, no toca AWS, no crea secrets reales, no imprime secretos, no reinicia PM2, no modifica binarios y no modifica `.env` reales.

## Artefacto principal

Se creo:

- `docs/checklist-qa-runtime-github-secrets-mvp-00-7E.md`

## GitHub Secrets documentados

Secrets requeridos:

- `QA_SSH_HOST`
- `QA_SSH_USER`
- `QA_SSH_PRIVATE_KEY`
- `QA_DEPLOY_BASE_PATH`
- `QA_API_BASE_URL`

Valores esperados sin secretos:

| Secret | Valor esperado documentado |
| --- | --- |
| `QA_DEPLOY_BASE_PATH` | `/home/ubuntu/manustienda` |
| `QA_API_BASE_URL` | `https://api.apptiendamanus.space` |
| `QA_SSH_USER` | `ubuntu` |
| `QA_SSH_HOST` | `<host o ip QA>` |
| `QA_SSH_PRIVATE_KEY` | Llave privada QA, no impresa |

No se crearon GitHub secrets reales.

## Runtime AWS documentado

Rutas runtime:

- `/home/ubuntu/manustienda/build`
- `/home/ubuntu/manustienda/build-reporteria`
- `/home/ubuntu/manustienda/build-facturacion-electronica`
- `/home/ubuntu/manustienda/build-perifericos`

Logs:

- `/home/ubuntu/manustienda/logs/api-linux`
- `/home/ubuntu/manustienda/logs/backend-reporteria-linux`
- `/home/ubuntu/manustienda/logs/backend-facturacion-electronica-linux`
- `/home/ubuntu/manustienda/logs/backend-perifericos-linux`

Backups:

- `/home/ubuntu/manustienda/backups/backends`

No se tocaron rutas AWS reales.

## `.env` runtime documentado

Checklist documenta:

- `build/.env` existe.
- `build-reporteria/.env` existe.
- `build-facturacion-electronica/.env.example` o `.env` requerido queda documentado.
- `build-perifericos/.env.example` o `.env` requerido queda documentado.
- API y reportería deben apuntar a `manus_tienda_qa`.
- `.env` reales no se versionan.
- Deploy no debe sobrescribir `.env`.

No se leyo, imprimio ni modifico ningun `.env` real.

## PM2 documentado

Archivo versionado:

- `scripts/pm2/ecosystem.qa.config.js`

Procesos esperados:

- `api-linux`
- `backend-reporteria-linux`
- `backend-facturacion-electronica-linux`
- `backend-perifericos-linux`

No se ejecuto PM2.

## Puertos documentados

| Servicio | Puerto |
| --- | ---: |
| API | `4020` |
| Reporteria | `4021` |
| Facturacion electronica | `4022` |
| Perifericos | `4023` |

Nota documentada:

- FE y perifericos pueden quedar solo localhost si Nginx no los expone publicamente todavia.

## Smoke checklist documentado

```bash
curl -fsS https://api.apptiendamanus.space/api/system/version
curl -fsS https://api.apptiendamanus.space/api/reports/health
curl -fsS http://127.0.0.1:4022/health
curl -fsS http://127.0.0.1:4023/health
```

No se ejecutaron smokes reales.

## Gate antes de `workflow_dispatch`

Checklist exige confirmar:

- Secrets existen.
- Runtime paths y permisos estan listos.
- `.env` runtime existe donde aplica.
- DB QA es `manus_tienda_qa`.
- PM2 esta disponible.
- Puertos no tienen conflictos.
- Hay espacio para backups.
- Hay responsable mirando logs/smoke.
- Rollback manual esta entendido.

## Validaciones

Comandos ejecutados localmente:

```bash
openspec.cmd validate mvp-web-hardening --type change --strict
git diff --check
git status --short
```

Resultados:

| Comando | Resultado |
| --- | --- |
| `openspec.cmd validate mvp-web-hardening --type change --strict` | PASS. `Change 'mvp-web-hardening' is valid`. |
| `git diff --check` | PASS. Git emitio warnings LF -> CRLF en archivos ya modificados. |
| `git status --short` | PASS. Cambios esperados en repo local. |

## Restricciones cumplidas

- No se ejecuto deploy.
- No se toco AWS.
- No se crearon secrets reales.
- No se imprimieron secretos.
- No se reinicio PM2.
- No se modificaron binarios.
- No se modificaron `.env` reales.
