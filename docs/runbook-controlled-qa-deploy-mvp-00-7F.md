# Runbook - Controlled QA Deploy - MVP-00.7F

Fecha: 2026-06-10

Resultado esperado del runbook: `QA_CONTROLLED_DEPLOY_RUNBOOK_READY`

Objetivo: ejecutar el primer deploy QA controlado usando `workflow_dispatch` del workflow `.github/workflows/deploy-qa-backends.yml`.

Este documento es operativo. Su creacion no ejecuta deploy, no toca AWS, no crea secrets reales y no reinicia PM2.

## 1. Alcance

Servicios incluidos:

| Servicio | Binario Linux | Runtime QA | Puerto |
| --- | --- | --- | ---: |
| API | `api-linux` | `/home/ubuntu/manustienda/build` | `4020` |
| Reporteria | `backend-reporteria-linux` | `/home/ubuntu/manustienda/build-reporteria` | `4021` |
| Facturacion electronica | `backend-facturacion-electronica-linux` | `/home/ubuntu/manustienda/build-facturacion-electronica` | `4022` |
| Perifericos | `backend-perifericos-linux` | `/home/ubuntu/manustienda/build-perifericos` | `4023` |

Artefactos base:

- `docs/evidencia-binarios-unificados-mvp-00-7B.md`
- `docs/evidencia-pm2-ecosystem-unificado-mvp-00-7C.md`
- `.github/workflows/deploy-qa-backends.yml`
- `scripts/deploy/qa-deploy-backends.sh`
- `scripts/pm2/ecosystem.qa.config.js`
- `docs/checklist-qa-runtime-github-secrets-mvp-00-7E.md`

## 2. Checklist pre-merge

Completar antes de mergear a `develop`.

| Check | Criterio |
| --- | --- |
| Rama feature revisada | Cambios de MVP-00.7B a MVP-00.7F revisados por humano |
| Worktree limpio o entendido | `git status --short` sin cambios inesperados |
| Formato Git | `git diff --check` sin errores |
| OpenSpec valido | `openspec.cmd validate mvp-web-hardening --type change --strict` sin errores |
| Workflow presente | `.github/workflows/deploy-qa-backends.yml` versionado |
| Deploy script presente | `scripts/deploy/qa-deploy-backends.sh` versionado |
| PM2 ecosystem presente | `scripts/pm2/ecosystem.qa.config.js` versionado |
| Checklist 00.7E completo | GitHub secrets y runtime QA revisados por humano |
| Sin secretos reales | No hay `.env` reales ni llaves privadas en git |
| Sin binarios versionados | `dist-bin` y artifacts generados no se suben al repo |

Comandos locales sugeridos antes del merge:

```powershell
git status --short
git diff --check
openspec.cmd validate mvp-web-hardening --type change --strict
```

No ejecutar deploy desde esta fase.

## 3. Merge feature a develop

Rama feature observada para este trabajo: `feat/develop/mvp-deploy-backends`.

Si la rama real cambia, reemplazar `<feature-branch>` por la rama correcta.

```bash
git checkout develop
git pull origin develop
git merge --no-ff feat/develop/mvp-deploy-backends
git status --short
git diff --check
openspec.cmd validate mvp-web-hardening --type change --strict
git push origin develop
```

Reglas:

- Resolver conflictos localmente.
- No aceptar cambios que introduzcan `.env`, llaves privadas o binarios.
- No ejecutar `workflow_dispatch` desde `develop`.
- No usar `git reset --hard` salvo decision explicita del responsable.

## 4. Merge develop a release/evolutivo/0.0.1

Este merge habilita el branch oficial QA.

```bash
git checkout release/evolutivo/0.0.1
git pull origin release/evolutivo/0.0.1
git merge --no-ff develop
git status --short
git diff --check
openspec.cmd validate mvp-web-hardening --type change --strict
git push origin release/evolutivo/0.0.1
```

Notas:

- El workflow tambien tiene trigger por `push` a `release/evolutivo/0.0.1`.
- Para el primer deploy controlado, preferir ventana supervisada y `workflow_dispatch`.
- Si el push dispara el workflow automaticamente, validar que la ventana QA esta aprobada antes de continuar con el job deploy.

## 5. GitHub Secrets

Crear o verificar en GitHub UI:

Ruta: repo GitHub -> `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`.

| Secret | Valor esperado sin secreto |
| --- | --- |
| `QA_SSH_HOST` | `<host o ip QA>` |
| `QA_SSH_USER` | `ubuntu` |
| `QA_SSH_PRIVATE_KEY` | Llave privada deploy QA, no imprimir |
| `QA_DEPLOY_BASE_PATH` | `/home/ubuntu/manustienda` |
| `QA_API_BASE_URL` | `https://api.apptiendamanus.space` |

Reglas:

- No guardar secrets reales en docs, issues, commits ni evidencia.
- No imprimir `QA_SSH_PRIVATE_KEY`.
- La llave SSH debe tener alcance QA.
- Si se rota un secret, registrar solo fecha y responsable, no valor.

## 6. Preparacion runtime AWS

Verificacion manual por responsable con acceso QA. Este runbook documenta comandos, no los ejecuta.

Carpetas runtime esperadas:

```bash
test -d /home/ubuntu/manustienda/build
test -d /home/ubuntu/manustienda/build-reporteria
test -d /home/ubuntu/manustienda/build-facturacion-electronica
test -d /home/ubuntu/manustienda/build-perifericos
test -d /home/ubuntu/manustienda/logs
test -d /home/ubuntu/manustienda/backups/backends
```

Permisos esperados:

- Usuario `ubuntu` puede escribir en `/home/ubuntu/manustienda`.
- Usuario `ubuntu` puede ejecutar PM2.
- Hay espacio suficiente para backups.
- Puertos `4020`, `4021`, `4022`, `4023` no tienen conflictos inesperados.
- No se abren puertos publicos nuevos en esta fase.

## 7. Validacion `.env` runtime

No imprimir valores completos de `.env`.

Existencia esperada:

```bash
test -f /home/ubuntu/manustienda/build/.env
test -f /home/ubuntu/manustienda/build-reporteria/.env
test -f /home/ubuntu/manustienda/build-facturacion-electronica/.env || test -f /home/ubuntu/manustienda/build-facturacion-electronica/.env.example
test -f /home/ubuntu/manustienda/build-perifericos/.env || test -f /home/ubuntu/manustienda/build-perifericos/.env.example
```

Checks sin imprimir secretos:

```bash
grep -q '^DB_NAME=manus_tienda_qa$' /home/ubuntu/manustienda/build/.env
grep -q '^DB_NAME=manus_tienda_qa$' /home/ubuntu/manustienda/build-reporteria/.env
grep -q '^PORT=4020$' /home/ubuntu/manustienda/build/.env || true
grep -q '^PORT=4021$' /home/ubuntu/manustienda/build-reporteria/.env || true
```

Confirmaciones humanas:

- API apunta a `manus_tienda_qa`.
- Reporteria apunta a `manus_tienda_qa`.
- Facturacion electronica usa `PORT=4022` si requiere `.env`.
- Perifericos usa `PERIPHERALS_PORT=4023` si requiere `.env`.
- Perifericos mantiene `PERIPHERALS_ENABLE_REAL_ADAPTERS=false`.
- Deploy no sobrescribe `.env`.
- `.env` reales no estan versionados.

## 8. Ejecucion `workflow_dispatch`

Ejecutar solo despues de completar checks anteriores.

Pasos en GitHub UI:

1. Abrir repo en GitHub.
2. Ir a `Actions`.
3. Seleccionar workflow `Deploy QA Backends`.
4. Pulsar `Run workflow`.
5. Seleccionar branch `release/evolutivo/0.0.1`.
6. Confirmar ventana QA y responsable mirando logs.
7. Pulsar `Run workflow`.

No pegar secrets en inputs. El workflow toma secrets desde GitHub Actions.

## 9. Validacion GitHub Actions

Job `build`:

- Checkout correcto.
- Node.js `20`.
- `npm ci` por servicio.
- `npm run build:bin` por servicio.
- `scripts/build/verify-backend-binaries.sh` pasa.
- Artifact `qa-backends-linux` subido.

Job `deploy`:

- Corre solo despues de `build`.
- Secrets requeridos existen.
- SSH se configura sin imprimir llave.
- Artifact se copia a carpeta temporal QA.
- `scripts/deploy/qa-deploy-backends.sh` crea backup con timestamp.
- Binarios quedan con `chmod +x`.
- `.env` runtime no se sobrescribe.
- `pm2 startOrReload` usa `scripts/pm2/ecosystem.qa.config.js`.
- `RUN_PM2_SAVE=NO` en primer deploy.
- Smoke local del script pasa.
- Smoke publico del workflow pasa.

Si cualquier paso falla, detener y revisar logs sin pegar secretos en tickets.

## 10. Validacion PM2

Ejecutar manualmente en QA despues del deploy.

```bash
pm2 list
pm2 describe api-linux
pm2 describe backend-reporteria-linux
pm2 describe backend-facturacion-electronica-linux
pm2 describe backend-perifericos-linux
```

Criterios:

- Los cuatro procesos estan `online`.
- `cwd` coincide con cada carpeta runtime.
- `script` coincide con cada binario Linux.
- `PORT` coincide con `4020`, `4021`, `4022`, `4023`.
- `restart count` no crece en bucle.
- Logs quedan bajo `/home/ubuntu/manustienda/logs/<servicio>/`.

Ejecutar `pm2 save` solo si el primer smoke queda aprobado por responsable.

## 11. Smoke tests

Publicos desde equipo del responsable:

```bash
curl -fsS https://api.apptiendamanus.space/api/system/version
curl -fsS https://api.apptiendamanus.space/api/reports/health
```

Locales dentro de instancia QA:

```bash
curl -fsS http://127.0.0.1:4022/health
curl -fsS http://127.0.0.1:4023/health
```

Criterios:

- HTTP 2xx.
- Sin trazas de secretos en salida.
- Facturacion electronica y perifericos pueden quedar solo localhost si Nginx no los expone.

## 12. Rollback manual

Rollback no es automatico en esta fase.

Si el deploy falla despues de reemplazar binarios:

1. Detener nuevos deploys.
2. Identificar timestamp de backup:

```bash
ls -la /home/ubuntu/manustienda/backups/backends/
```

3. Restaurar solo el servicio afectado:

```bash
cp -p /home/ubuntu/manustienda/backups/backends/<timestamp>/<servicio>/<binario> /home/ubuntu/manustienda/<runtime>/<binario>
chmod +x /home/ubuntu/manustienda/<runtime>/<binario>
pm2 restart <servicio> --update-env
```

4. Ejecutar smoke del servicio restaurado.
5. Ejecutar `pm2 save` solo si rollback queda aprobado.

No tocar base de datos durante rollback de binarios.

## 13. Cierre

Marcar `QA_CONTROLLED_DEPLOY_RUNBOOK_READY` cuando:

- Merge feature -> `develop` esta validado.
- Merge `develop` -> `release/evolutivo/0.0.1` esta validado.
- GitHub secrets existen sin exponer valores.
- Runtime QA y `.env` fueron revisados.
- `workflow_dispatch` fue ejecutado en ventana controlada.
- Actions quedan verdes.
- PM2 muestra cuatro procesos `online`.
- Smoke tests pasan.
- Rollback manual queda entendido y probado solo si fue necesario.
