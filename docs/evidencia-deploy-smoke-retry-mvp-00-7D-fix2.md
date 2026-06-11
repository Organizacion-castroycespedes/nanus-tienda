# Evidencia - Deploy smoke retry - MVP-00.7D-FIX2

Fecha: 2026-06-10

Resultado esperado: `QA_DEPLOY_SMOKE_RETRY_READY`

## Problema

GitHub Actions Deploy QA logro:

- SSH OK.
- Backup OK.
- Install OK.
- PM2 reload/start OK.

Pero fallo en smoke inmediato:

```text
curl: (7) Failed to connect to 127.0.0.1 port 4020
```

Validacion manual posterior en AWS reportada:

- `4020 /api/system/version`: 200.
- `4021 /api/reports/health`: 200.
- `4022 /health`: 200.
- `4023 /health`: 200.

Conclusion: el deploy necesitaba espera controlada entre `pm2 startOrReload` y los smoke checks locales.

## Cambio aplicado

Archivo modificado:

- `scripts/deploy/qa-deploy-backends.sh`

Se agrego funcion:

- `wait_for_http url max_attempts sleep_seconds`

Comportamiento:

- Usa `curl -fsS`.
- Imprime intento actual.
- Reintenta hasta 30 intentos.
- Espera 2 segundos entre intentos.
- Falla solo despues del ultimo intento.
- Mantiene `RUN_LOCAL_SMOKE=YES/NO`.

Smokes cubiertos:

| Servicio | URL local |
| --- | --- |
| `api-linux` | `http://127.0.0.1:4020/api/system/version` |
| `backend-reporteria-linux` | `http://127.0.0.1:4021/api/reports/health` |
| `backend-facturacion-electronica-linux` | `http://127.0.0.1:4022/health` |
| `backend-perifericos-linux` | `http://127.0.0.1:4023/health` |

## Validaciones

| Comando | Resultado |
| --- | --- |
| `bash -n scripts/deploy/qa-deploy-backends.sh` | OK |
| `openspec.cmd validate mvp-web-hardening --type change --strict` | OK. `Change 'mvp-web-hardening' is valid` |
| `git diff --check` | OK. Solo warnings LF -> CRLF en archivos modificados |
| `git status --short` | OK. Muestra cambios esperados en `scripts/deploy/qa-deploy-backends.sh`, `tasks.md` y esta evidencia |

## Restricciones confirmadas

- AWS: no tocado.
- Deploy: no ejecutado.
- Secrets: no modificados.
- PM2: no ejecutado.
- Binarios: no modificados.
- Logica funcional de servicios: sin cambios.
