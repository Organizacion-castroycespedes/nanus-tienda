# Evidencia - GitHub Actions Deploy QA - MVP-00.7D

Fecha: 2026-06-10

Cambio OpenSpec: `mvp-web-hardening`

Fase: `MVP-00.7D - GitHub Actions Deploy QA`

Resultado: `QA_GITHUB_ACTIONS_DEPLOY_READY`

## Objetivo

Crear workflow GitHub Actions para compilar y desplegar automaticamente los cuatro backends binarios en AWS QA cuando se use la rama oficial QA:

- `release/evolutivo/0.0.1`

Contexto usado:

- `docs/evidencia-binarios-unificados-mvp-00-7B.md`
- `docs/evidencia-pm2-ecosystem-unificado-mvp-00-7C.md`

Esta fase no ejecuta deploy real, no crea secrets reales, no toca AWS, no reinicia PM2, no sube binarios, no expone secretos y no cambia logica funcional.

## Archivos creados

- `.github/workflows/deploy-qa-backends.yml`
- `scripts/deploy/qa-deploy-backends.sh`

## Health endpoints reales revisados

| Servicio | Puerto QA | Endpoint real local | Endpoint publico esperado o nota |
| --- | ---: | --- | --- |
| `api` | `4020` | `GET /api/system/version` | `GET ${QA_API_BASE_URL}/api/system/version` |
| `backend-reporteria` | `4021` | `GET /api/reports/health` | `GET ${QA_API_BASE_URL}/api/reports/health`; el guard permite actor mock si no hay JWT. |
| `backend-facturacion-electronica` | `4022` | `GET /health` | No tiene global prefix. Smoke real detectado: `http://127.0.0.1:4022/health` via SSH local. |
| `backend-perifericos` | `4023` | `GET /health` | No tiene global prefix y escucha en `127.0.0.1`. Smoke real detectado: `http://127.0.0.1:4023/health` via SSH local. |

No se detectaron rutas publicas versionadas existentes para:

- `/api/facturacion-electronica/health`
- `/api/perifericos/health`

Por eso el workflow usa smoke publico para API/reporteria y smoke local en AWS para facturacion electronica/perifericos.

## Workflow creado

Archivo:

- `.github/workflows/deploy-qa-backends.yml`

Triggers:

- `push` a `release/evolutivo/0.0.1`
- `workflow_dispatch`

Permisos:

- `contents: read`

## Job `build`

Ejecuta:

1. `actions/checkout@v4`.
2. `actions/setup-node@v4` con Node `20`.
3. `npm ci` y `npm run build:bin` en:
   - `api`
   - `backend-reporteria`
   - `backend-facturacion-electronica`
   - `backend-perifericos`
4. `scripts/build/verify-backend-binaries.sh`.
5. Empaqueta solo binarios Linux:
   - `api-linux`
   - `backend-reporteria-linux`
   - `backend-facturacion-electronica-linux`
   - `backend-perifericos-linux`
6. Incluye en el artefacto:
   - `scripts/deploy/qa-deploy-backends.sh`
   - `scripts/pm2/ecosystem.qa.config.js`
7. Sube artefacto `qa-backends-linux`.

## Job `deploy`

Depende de `build`.

Condicion:

```yaml
if: github.ref == 'refs/heads/release/evolutivo/0.0.1' || github.event_name == 'workflow_dispatch'
```

Secrets referenciados, sin valores reales:

- `QA_SSH_HOST`
- `QA_SSH_USER`
- `QA_SSH_PRIVATE_KEY`
- `QA_DEPLOY_BASE_PATH`
- `QA_API_BASE_URL`

Pasos:

1. Descargar artefacto Linux.
2. Validar que existen los secrets requeridos, sin imprimir valores.
3. Configurar SSH en runner.
4. Crear carpeta temporal en QA:
   - `${QA_DEPLOY_BASE_PATH}/tmp/github-actions/backends-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}`
5. Copiar artefacto por `scp`.
6. Extraer artefacto en AWS.
7. Ejecutar `scripts/deploy/qa-deploy-backends.sh` en AWS.
8. Ejecutar smoke publico:
   - `${QA_API_BASE_URL}/api/system/version`
   - `${QA_API_BASE_URL}/api/reports/health`

## Script remoto

Archivo:

- `scripts/deploy/qa-deploy-backends.sh`

Contrato:

```bash
DEPLOY_BASE_PATH=/home/ubuntu/manustienda \
RUN_LOCAL_SMOKE=YES \
RUN_PM2_SAVE=NO \
bash scripts/deploy/qa-deploy-backends.sh <staging-bin-dir>
```

Comportamiento:

- Recibe carpeta temporal con binarios Linux.
- Valida `DEPLOY_BASE_PATH` seguro.
- Crea backup con timestamp en:
  - `${DEPLOY_BASE_PATH}/backups/backends/YYYYMMDD-HHMMSS/`
- Asegura carpetas runtime:
  - `build`
  - `build-reporteria`
  - `build-facturacion-electronica`
  - `build-perifericos`
- Reemplaza solo binarios esperados.
- No elimina ni sobrescribe `.env`.
- Copia `scripts/pm2/ecosystem.qa.config.js` a `${DEPLOY_BASE_PATH}/scripts/pm2/ecosystem.qa.config.js`.
- Ejecuta:

```bash
pm2 startOrReload "${DEPLOY_BASE_PATH}/scripts/pm2/ecosystem.qa.config.js" \
  --only "api-linux,backend-reporteria-linux,backend-facturacion-electronica-linux,backend-perifericos-linux" \
  --update-env
```

- Ejecuta smoke local si `RUN_LOCAL_SMOKE=YES`.
- No ejecuta `pm2 save` salvo `RUN_PM2_SAVE=YES`.

## Smoke local en AWS

El script remoto valida:

```bash
curl -fsS http://127.0.0.1:4020/api/system/version
curl -fsS http://127.0.0.1:4021/api/reports/health
curl -fsS http://127.0.0.1:4022/health
curl -fsS http://127.0.0.1:4023/health
```

## Rollback manual documentado

No se implementa rollback automatico destructivo todavia.

Rollback manual por servicio:

1. Identificar backup:

```bash
ls -la /home/ubuntu/manustienda/backups/backends/
```

2. Reponer binario anterior del servicio afectado:

```bash
cp -p /home/ubuntu/manustienda/backups/backends/<timestamp>/<servicio>/<binario> \
  /home/ubuntu/manustienda/<runtime>/<binario>
chmod +x /home/ubuntu/manustienda/<runtime>/<binario>
```

3. Reiniciar solo servicio afectado:

```bash
pm2 restart <servicio> --update-env
```

4. Ejecutar smoke local del servicio.
5. Ejecutar `pm2 save` solo si rollback queda aprobado.

No tocar DB durante rollback de binarios.

## Riesgos y pendientes

- El workflow queda listo para ejecutarse cuando exista en la rama `release/evolutivo/0.0.1`; no fue ejecutado localmente.
- No se crearon secrets reales.
- `ssh-keyscan` usa el host provisto por secret. Para hardening posterior se recomienda secret o variable de `known_hosts` pinneado.
- `pm2 save` queda desactivado por defecto con `RUN_PM2_SAVE=NO`.
- Facturacion electronica y perifericos no tienen endpoint publico detectado. El smoke se hace local por SSH en la instancia QA.

## Validaciones

Comandos ejecutados localmente:

```bash
bash -n scripts/deploy/qa-deploy-backends.sh
openspec.cmd validate mvp-web-hardening --type change --strict
git diff --check
git status --short
```

Resultados:

| Comando | Resultado |
| --- | --- |
| `bash -n scripts/deploy/qa-deploy-backends.sh` | PASS. Sintaxis bash valida. |
| `openspec.cmd validate mvp-web-hardening --type change --strict` | PASS. `Change 'mvp-web-hardening' is valid`. |
| `git diff --check` | PASS. Git emitio warnings LF -> CRLF en archivos ya modificados. |
| `git status --short` | PASS. Cambios esperados en repo local. |

## Restricciones cumplidas

- No se ejecuto deploy real.
- No se crearon secrets reales.
- No se toco AWS.
- No se reinicio PM2.
- No se subieron binarios.
- No se expusieron secretos.
- No se cambio logica funcional.
