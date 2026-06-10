# Evidencia - Controlled QA Deploy Runbook - MVP-00.7F

Fecha: 2026-06-10

Resultado: `QA_CONTROLLED_DEPLOY_RUNBOOK_READY`

## Alcance

Se creo runbook para ejecutar el primer deploy QA controlado usando `workflow_dispatch` del workflow `.github/workflows/deploy-qa-backends.yml`.

No se ejecuto deploy. No se toco AWS. No se crearon secrets reales. No se reinicio PM2. No se modificaron `.env` reales.

## Artefactos revisados

| Artefacto | Uso |
| --- | --- |
| `docs/evidencia-binarios-unificados-mvp-00-7B.md` | Base de binarios unificados |
| `docs/evidencia-pm2-ecosystem-unificado-mvp-00-7C.md` | Base de PM2 ecosystem QA |
| `.github/workflows/deploy-qa-backends.yml` | Workflow QA por push y `workflow_dispatch` |
| `scripts/deploy/qa-deploy-backends.sh` | Deploy remoto con backup, reemplazo, PM2 y smoke |
| `scripts/pm2/ecosystem.qa.config.js` | Configuracion PM2 QA para cuatro backends |
| `docs/checklist-qa-runtime-github-secrets-mvp-00-7E.md` | Checklist runtime y GitHub secrets |

## Artefacto creado

| Archivo | Contenido |
| --- | --- |
| `docs/runbook-controlled-qa-deploy-mvp-00-7F.md` | Runbook controlado para merge, secrets, runtime AWS, `.env`, `workflow_dispatch`, Actions, PM2, smoke y rollback |

## Cobertura del runbook

- Checklist pre-merge.
- Merge feature branch a `develop`.
- Merge `develop` a `release/evolutivo/0.0.1`.
- Creacion/verificacion de GitHub secrets sin registrar valores reales.
- Preparacion runtime AWS sin ejecutar comandos desde esta fase.
- Validacion `.env` sin imprimir secretos.
- Ejecucion manual de `workflow_dispatch`.
- Validacion de jobs GitHub Actions.
- Validacion PM2 despues del deploy.
- Smoke tests publicos y locales.
- Rollback manual de binarios.

## Validaciones locales

| Comando | Resultado |
| --- | --- |
| `openspec.cmd validate mvp-web-hardening --type change --strict` | OK. `Change 'mvp-web-hardening' is valid` |
| `git diff --check` | OK. Solo warnings LF -> CRLF en archivos ya modificados |
| `git status --short` | OK. Muestra cambios esperados de MVP-00.7A a MVP-00.7F |

## Confirmacion de restricciones

- Deploy real: no ejecutado.
- AWS: no tocado.
- GitHub secrets reales: no creados.
- Secretos: no impresos.
- PM2: no ejecutado.
- Binarios: no modificados.
- `.env` reales: no modificados.
