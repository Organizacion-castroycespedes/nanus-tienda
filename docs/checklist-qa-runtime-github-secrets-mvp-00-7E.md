# Checklist - QA runtime + GitHub secrets - MVP-00.7E

Fecha: 2026-06-10

Objetivo: preparar el primer deploy QA por `workflow_dispatch` del workflow `.github/workflows/deploy-qa-backends.yml` sin exponer secretos ni tocar infraestructura desde este checklist.

Resultado esperado al completar checklist humano: `QA_RUNTIME_GITHUB_SECRETS_CHECKLIST_READY`

## 1. GitHub Secrets requeridos

Crear/verificar en GitHub Actions secrets del repo. No guardar valores reales en docs, issues ni evidencias.

| Secret | Valor esperado sin secreto | Estado |
| --- | --- | --- |
| `QA_SSH_HOST` | `<host o ip QA>` | Pendiente verificacion humana |
| `QA_SSH_USER` | `ubuntu` | Pendiente verificacion humana |
| `QA_SSH_PRIVATE_KEY` | Llave privada deploy QA, no imprimir | Pendiente verificacion humana |
| `QA_DEPLOY_BASE_PATH` | `/home/ubuntu/manustienda` | Pendiente verificacion humana |
| `QA_API_BASE_URL` | `https://api.apptiendamanus.space` | Pendiente verificacion humana |

Reglas:

- No crear secrets desde CLI en esta fase.
- No pegar secrets en terminal compartida, docs o tickets.
- Usar solo GitHub Actions secrets, no variables en claro.
- Confirmar que la llave SSH corresponde solo a QA.

## 2. Runtime AWS

Verificar manualmente en QA antes de ejecutar `workflow_dispatch`.

| Ruta | Uso | Estado |
| --- | --- | --- |
| `/home/ubuntu/manustienda/build` | Runtime `api-linux` | Pendiente verificacion humana |
| `/home/ubuntu/manustienda/build-reporteria` | Runtime `backend-reporteria-linux` | Pendiente verificacion humana |
| `/home/ubuntu/manustienda/build-facturacion-electronica` | Runtime `backend-facturacion-electronica-linux` | Pendiente verificacion humana |
| `/home/ubuntu/manustienda/build-perifericos` | Runtime `backend-perifericos-linux` | Pendiente verificacion humana |
| `/home/ubuntu/manustienda/logs/api-linux` | Logs API | Pendiente verificacion humana |
| `/home/ubuntu/manustienda/logs/backend-reporteria-linux` | Logs reporteria | Pendiente verificacion humana |
| `/home/ubuntu/manustienda/logs/backend-facturacion-electronica-linux` | Logs FE | Pendiente verificacion humana |
| `/home/ubuntu/manustienda/logs/backend-perifericos-linux` | Logs perifericos | Pendiente verificacion humana |
| `/home/ubuntu/manustienda/backups/backends` | Backups por deploy | Pendiente verificacion humana |

El script `scripts/deploy/qa-deploy-backends.sh` puede crear rutas runtime y backups si faltan, pero el primer deploy debe revisar permisos antes.

## 3. `.env` runtime

El deploy no debe sobrescribir `.env`.

| Ruta | Requisito | Estado |
| --- | --- | --- |
| `/home/ubuntu/manustienda/build/.env` | Debe existir para API QA | Pendiente verificacion humana |
| `/home/ubuntu/manustienda/build-reporteria/.env` | Debe existir para reporteria QA | Pendiente verificacion humana |
| `/home/ubuntu/manustienda/build-facturacion-electronica/.env` | Requerido si QA necesita config distinta a defaults seguros | Pendiente verificacion humana |
| `/home/ubuntu/manustienda/build-facturacion-electronica/.env.example` | Referencia permitida sin secretos si se decide no usar `.env` real | Pendiente verificacion humana |
| `/home/ubuntu/manustienda/build-perifericos/.env` | Requerido si QA necesita config distinta a defaults seguros | Pendiente verificacion humana |
| `/home/ubuntu/manustienda/build-perifericos/.env.example` | Referencia permitida sin secretos si se decide no usar `.env` real | Pendiente verificacion humana |

Checklist de contenido sin imprimir valores:

- API apunta a DB `manus_tienda_qa`.
- Reporteria apunta a DB `manus_tienda_qa`.
- API usa `PORT=4020` o queda alineado con PM2 ecosystem.
- Reporteria usa `PORT=4021` o queda alineado con PM2 ecosystem.
- Facturacion electronica usa `PORT=4022` si requiere `.env`.
- Perifericos usa `PERIPHERALS_PORT=4023` si requiere `.env`.
- Perifericos mantiene `PERIPHERALS_ENABLE_REAL_ADAPTERS=false`.
- No versionar `.env` reales.
- No copiar `.env` dentro del artifact.
- No imprimir `.env` con `cat`, logs o screenshots.

## 4. PM2

Archivo versionado requerido:

- `scripts/pm2/ecosystem.qa.config.js`

Procesos esperados:

| Proceso PM2 | Runtime | Puerto |
| --- | --- | ---: |
| `api-linux` | `/home/ubuntu/manustienda/build` | `4020` |
| `backend-reporteria-linux` | `/home/ubuntu/manustienda/build-reporteria` | `4021` |
| `backend-facturacion-electronica-linux` | `/home/ubuntu/manustienda/build-facturacion-electronica` | `4022` |
| `backend-perifericos-linux` | `/home/ubuntu/manustienda/build-perifericos` | `4023` |

Antes del primer deploy:

- Confirmar que PM2 existe en QA.
- Confirmar usuario `ubuntu` puede ejecutar PM2.
- Confirmar que `pm2 startOrReload` es aceptable para la ventana QA.
- No ejecutar `pm2 save` hasta aprobar primer smoke.

## 5. Puertos

| Servicio | Puerto | Exposicion esperada |
| --- | ---: | --- |
| API | `4020` | Publico por Nginx como API principal |
| Reporteria | `4021` | Publico por Nginx bajo `/api/reports/` si configurado |
| Facturacion electronica | `4022` | Puede quedar solo localhost si Nginx no expone todavia |
| Perifericos | `4023` | Puede quedar solo localhost; recomendado no exponer publico todavia |

Reglas:

- FE/perifericos pueden validar por smoke local SSH.
- No abrir nuevos puertos publicos en esta fase.
- No modificar Nginx en esta fase.

## 6. Smoke tests

Smokes del workflow/script:

```bash
curl -fsS https://api.apptiendamanus.space/api/system/version
curl -fsS https://api.apptiendamanus.space/api/reports/health
curl -fsS http://127.0.0.1:4022/health
curl -fsS http://127.0.0.1:4023/health
```

Notas:

- Los dos primeros son publicos por `QA_API_BASE_URL`.
- Los dos ultimos son locales en la instancia QA.
- No imprimir tokens ni credenciales durante smoke.

## 7. Gate antes de `workflow_dispatch`

Ejecutar `workflow_dispatch` solo si:

- Los 5 GitHub secrets existen.
- `QA_DEPLOY_BASE_PATH` apunta a `/home/ubuntu/manustienda`.
- `.env` reales requeridos existen en runtime y no fueron versionados.
- API y reporteria apuntan a `manus_tienda_qa`.
- PM2 esta instalado y accesible para `ubuntu`.
- Puertos `4020` a `4023` no tienen conflictos.
- Hay espacio para backups.
- Existe ventana QA para restart controlado.
- Hay responsable mirando logs/smoke.
- Rollback manual esta entendido.

## 8. Rollback manual

Si el workflow falla despues de reemplazar binarios:

1. No ejecutar mas deploys.
2. Identificar backup:

```bash
ls -la /home/ubuntu/manustienda/backups/backends/
```

3. Restaurar solo el binario afectado desde backup.
4. Ejecutar `chmod +x` sobre el binario restaurado.
5. Ejecutar `pm2 restart <servicio> --update-env`.
6. Ejecutar smoke local del servicio.
7. Ejecutar `pm2 save` solo si rollback queda aprobado.

No tocar DB durante rollback de binarios.
