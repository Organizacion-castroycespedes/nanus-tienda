# Evidencia - PM2 ecosystem unificado - MVP-00.7C

Fecha: 2026-06-10

Cambio OpenSpec: `mvp-web-hardening`

Fase: `MVP-00.7C - PM2 ecosystem unificado`

Resultado: `QA_PM2_ECOSYSTEM_READY`

## Objetivo

Crear una configuracion PM2 QA versionada para ejecutar de forma homogenea los cuatro backends binarios definidos en `docs/evidencia-binarios-unificados-mvp-00-7B.md`.

Esta fase no ejecuta PM2, no toca AWS, no hace deploy, no modifica secretos, no sube binarios, no reinicia procesos y no cambia logica funcional.

## Archivo creado

Archivo versionado:

- `scripts/pm2/ecosystem.qa.config.js`

## Apps PM2 definidas

| App PM2 | `cwd` runtime | `script` | Puerto | Logs |
| --- | --- | --- | ---: | --- |
| `api-linux` | `/home/ubuntu/manustienda/build` | `./api-linux` | `4020` | `/home/ubuntu/manustienda/logs/api-linux/` |
| `backend-reporteria-linux` | `/home/ubuntu/manustienda/build-reporteria` | `./backend-reporteria-linux` | `4021` | `/home/ubuntu/manustienda/logs/backend-reporteria-linux/` |
| `backend-facturacion-electronica-linux` | `/home/ubuntu/manustienda/build-facturacion-electronica` | `./backend-facturacion-electronica-linux` | `4022` | `/home/ubuntu/manustienda/logs/backend-facturacion-electronica-linux/` |
| `backend-perifericos-linux` | `/home/ubuntu/manustienda/build-perifericos` | `./backend-perifericos-linux` | `4023` | `/home/ubuntu/manustienda/logs/backend-perifericos-linux/` |

## Configuracion comun

Cada app define:

- `interpreter: "none"` para ejecutar binarios Linux directamente.
- `exec_mode: "fork"`.
- `instances: 1`.
- `autorestart: true`.
- `max_restarts: 10`.
- `restart_delay: 5000`.
- `out_file` y `error_file` por servicio.
- `merge_logs: false`.
- `env.NODE_ENV=qa`.
- `env.PORT` correspondiente.

`backend-perifericos-linux` tambien define:

- `PERIPHERALS_PORT=4023` porque el servicio usa esa variable en runtime.
- `PERIPHERALS_ENABLE_REAL_ADAPTERS=false` para mantener modo seguro sin hardware real.

## Secretos y runtime env

No se incluyen secretos en `ecosystem.qa.config.js`.

No se incluyen:

- DB host/user/password.
- JWT secrets.
- tokens internos.
- API keys.
- private keys.
- cadenas de conexion.

Convencion segura:

- Cada carpeta runtime `build-*` debe mantener su `.env` real fuera del binario y fuera de git.
- El ecosystem solo debe contener variables no secretas necesarias para QA.
- No imprimir secretos en `pm2 logs`, docs ni evidencia.

## Comandos manuales documentados

Estos comandos son referencia operativa. No fueron ejecutados en esta fase.

### Start inicial

```bash
pm2 start scripts/pm2/ecosystem.qa.config.js
```

### Reload del ecosystem

```bash
pm2 reload scripts/pm2/ecosystem.qa.config.js --update-env
```

### Restart controlado por servicio

```bash
pm2 restart api-linux --update-env
pm2 restart backend-reporteria-linux --update-env
pm2 restart backend-facturacion-electronica-linux --update-env
pm2 restart backend-perifericos-linux --update-env
```

### Persistir procesos

```bash
pm2 save
```

### Logs

```bash
pm2 logs api-linux --lines 100
pm2 logs backend-reporteria-linux --lines 100
pm2 logs backend-facturacion-electronica-linux --lines 100
pm2 logs backend-perifericos-linux --lines 100
```

## Rollback manual documentado

Rollback por servicio, sin tocar DB:

1. Detener avance del deploy.
2. Reponer el binario anterior desde backup o release anterior en la carpeta runtime correspondiente.
3. Confirmar permisos:

```bash
chmod +x /home/ubuntu/manustienda/build/api-linux
chmod +x /home/ubuntu/manustienda/build-reporteria/backend-reporteria-linux
chmod +x /home/ubuntu/manustienda/build-facturacion-electronica/backend-facturacion-electronica-linux
chmod +x /home/ubuntu/manustienda/build-perifericos/backend-perifericos-linux
```

4. Reiniciar solo el servicio afectado:

```bash
pm2 restart <servicio> --update-env
```

5. Validar smoke local del servicio afectado.
6. Ejecutar `pm2 save` solo si el rollback queda aprobado.

Si el runtime usa symlinks, el rollback debe repuntar la carpeta runtime al release anterior y luego reiniciar el servicio afectado.

## Validaciones

Comandos ejecutados localmente:

```bash
node -c scripts/pm2/ecosystem.qa.config.js
openspec.cmd validate mvp-web-hardening --type change --strict
git diff --check
git status --short
```

Resultados:

| Comando | Resultado |
| --- | --- |
| `node -c scripts/pm2/ecosystem.qa.config.js` | PASS. Sintaxis JS valida. |
| `openspec.cmd validate mvp-web-hardening --type change --strict` | PASS. `Change 'mvp-web-hardening' is valid`. |
| `git diff --check` | PASS. Git emitio warnings LF -> CRLF en archivos ya modificados. |
| `git status --short` | PASS. Cambios esperados en repo local. |

Nota:

- Un primer intento de `node -c` fallo por resolucion de `node` dentro del sandbox local; se repitio como validacion local permitida y paso.

## Restricciones cumplidas

- No se ejecuto PM2.
- No se toco AWS.
- No se hizo deploy.
- No se modificaron secretos.
- No se subieron binarios.
- No se reiniciaron procesos.
- No se cambio logica funcional.
