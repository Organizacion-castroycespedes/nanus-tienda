# Evidencia QA AWS Pre-check Dry-run - MVP-00.3

Fecha: 2026-06-09

Cambio OpenSpec: `mvp-web-hardening`

Rama: `feat/develop/mvp-web-hardening`

Resultado: `QA_AWS_DEPLOY_READY`

Motivo: las salidas sanitizadas del pre-check remoto confirman infraestructura sana, runtime Node/npm instalado, PM2 online, Nginx OK, PostgreSQL activo, disco/memoria OK y SSL valido. Queda listo para siguiente fase de backup/snapshot y despliegue controlado. No ejecutar migraciones sin backup.

## Objetivo

Realizar una validacion remota de solo lectura sobre el ambiente QA AWS para confirmar si esta listo para recibir el despliegue de Manus POS.

## Alcance

Incluido:

- Salidas sanitizadas de pre-check remoto de solo lectura.
- Validacion HTTP publica de Web QA.
- Validacion HTTP publica de endpoints base API QA conocidos.
- Clasificacion de riesgos.
- Recomendacion deploy/no deploy.

Pendiente para fase de deploy:

- Backup/snapshot.
- Clasificacion final de `manus_tienda` como QA dedicado o ambiente compartido.
- Health endpoint real si el actual no expone `/health`.
- Rutas deploy y rama actual si se requiere antes de ejecutar despliegue.

## Restricciones cumplidas

- No se ejecuto `git pull`.
- No se ejecuto `git merge`.
- No se ejecuto `pm2 restart`.
- No se ejecuto `pm2 reload`.
- No se ejecuto `reboot`.
- No se ejecutaron migraciones.
- No se ejecuto `ALTER TABLE`, `INSERT`, `UPDATE` ni `DELETE`.
- No se modifico Nginx.
- No se modifico PM2.
- No se modifico PostgreSQL.
- No se modifico Vercel.
- No se desplego.
- No se toco PRD.

## Comandos ejecutados

### Exploracion local de acceso SSH

```powershell
Get-Command ssh
Get-Content scripts\config\db.env | Select-String -Pattern "^SSH_HOST=|^SSH_PORT=|^SSH_USER=|^SSH_REMOTE_DIR="
```

Resultado:

- Cliente SSH disponible: `C:\Program Files\Git\usr\bin\ssh.exe`.
- Config local versionada/no secreta apunta a ejemplo:
  - `SSH_HOST=example.com`
  - `SSH_PORT=22`
  - `SSH_USER=ubuntu`
  - `SSH_REMOTE_DIR=/opt/flexibuild-core-platform/apps`

### Intento SSH dry-run inicial

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 ubuntu@api.apptiendamanus.space hostname
```

Resultado:

- Fallo por verificacion de host key.
- No se ejecuto comando remoto.

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL ubuntu@api.apptiendamanus.space hostname
```

Resultado:

- Fallo: `Permission denied (publickey)`.
- No se ejecuto comando remoto exitoso.
- No se obtuvo `hostname` desde la instancia.

### Salidas sanitizadas recibidas del pre-check remoto

El operador aporto salidas sanitizadas de comandos remotos de solo lectura. No se ejecutaron cambios desde esta sesion.

Comandos cubiertos por las salidas:

```bash
hostname
uname -a
lsb_release -a
free -h
df -h
uptime
node -v
npm -v
pm2 list
sudo nginx -t
ls /etc/nginx/sites-enabled
sudo certbot certificates
sudo systemctl status postgresql
sudo -u postgres psql -c "\l"
```

### Health HTTP publico

```powershell
Invoke-WebRequest -UseBasicParsing https://www.apptiendamanus.space -Method GET -TimeoutSec 15
```

Resultado:

- HTTP `200`.
- Web QA responde publicamente.

```powershell
Invoke-WebRequest -UseBasicParsing https://api.apptiendamanus.space/health -Method GET -TimeoutSec 15
Invoke-WebRequest -UseBasicParsing https://api.apptiendamanus.space/api/health -Method GET -TimeoutSec 15
Invoke-WebRequest -UseBasicParsing https://api.apptiendamanus.space/api -Method GET -TimeoutSec 15
Invoke-WebRequest -UseBasicParsing https://api.apptiendamanus.space -Method GET -TimeoutSec 15
```

Resultado:

- `https://api.apptiendamanus.space/health`: HTTP `404`, body controlado `{"message":"Cannot GET /health","error":"Not Found","statusCode":404}`.
- `https://api.apptiendamanus.space/api/health`: HTTP `404`, body controlado `{"message":"Cannot GET /api/health","error":"Not Found","statusCode":404}`.
- `https://api.apptiendamanus.space/api`: HTTP `404`, body controlado `{"message":"Cannot GET /api","error":"Not Found","statusCode":404}`.
- `https://api.apptiendamanus.space/`: HTTP `404`, body controlado `{"message":"Cannot GET /","error":"Not Found","statusCode":404}`.

Interpretacion:

- El dominio API responde con una aplicacion NestJS o gateway compatible con errores JSON.
- No se confirmo endpoint health publico.
- Falta identificar endpoint health real o exponerlo en fase futura autorizada.

## Infraestructura

Validada mediante salidas sanitizadas del pre-check remoto:

| Item | Resultado |
| --- | --- |
| Hostname | `ip-172-26-15-126` |
| Sistema operativo | Ubuntu 24.04.4 LTS |
| Kernel | `6.17.0-1013-aws` |
| Uptime | 31 dias |
| Load average | `0.00` |
| RAM | 1.9 Gi total, 1.1 Gi disponible |
| Swap | 2.0 Gi total, 36 Mi usado |
| Disco root | 58 G total, 7.8 G usado, 50 G disponible, 14% |
| Reboot pendiente | Si, system restart required |

## Node

Validado mediante salidas sanitizadas:

| Runtime | Version |
| --- | --- |
| Node | `v22.22.2` |
| npm | `10.9.7` |

## PM2

Validado mediante salidas sanitizadas:

| Proceso | Estado |
| --- | --- |
| `api-linux` | online |
| `backend-reporteria-linux` | online |
| `flexi-api-qa` | online |
| `flexi-documental-qa` | online |

Nota: no se recibieron en esta actualizacion los detalles de `pm2 describe <name>` como uptime, cwd, script principal y puertos. Quedan recomendados para evidencia previa al despliegue si el equipo requiere trazabilidad mas fina.

## Nginx

Validado mediante salidas sanitizadas:

| Check | Resultado |
| --- | --- |
| `sudo nginx -t` | successful |
| `sites-enabled` | `flexi-qa`, `manus-api` |

## SSL

Validado mediante salidas sanitizadas:

| Dominio | Vence | Dias restantes al 2026-06-09 | Riesgo |
| --- | --- | --- | --- |
| `api.apptiendamanus.space` | 2026-07-27 | 48 | YELLOW |
| `api.coretenants.space` | 2026-07-23 | 44 | YELLOW |

## PostgreSQL

Validado mediante salidas sanitizadas:

- Servicio PostgreSQL: active.

| Base | Owner | Estado dry-run |
| --- | --- | --- |
| `manus_tienda` | `manus_user` | Confirmada |
| `flexibuild_qa` | `flexi_user` | Confirmada |

Nota: no se recibio `SELECT version();` en esta actualizacion. La version exacta de PostgreSQL queda recomendada para evidencia previa al despliegue.

## Rutas despliegue

No validadas por SSH en esta fase.

Pendiente localizar sin cambiar:

- ruta de `api-linux`,
- ruta de `backend-reporteria-linux`,
- repositorio,
- rama actual,
- estado git.

Comandos permitidos futuros:

```bash
git status
git branch
git rev-parse --abbrev-ref HEAD
```

Prohibido:

- `git pull`,
- `git merge`,
- cualquier checkout que cambie estado.

## Health

| Check | Resultado | Riesgo |
| --- | --- | --- |
| Web `https://www.apptiendamanus.space` | HTTP 200 | GREEN |
| API `https://api.apptiendamanus.space/` | HTTP 404 JSON controlado | YELLOW |
| API `/health` | HTTP 404 JSON controlado | YELLOW |
| API `/api/health` | HTTP 404 JSON controlado | YELLOW |
| API `/api` | HTTP 404 JSON controlado | YELLOW |

## Riesgos

| Riesgo | Clasificacion | Motivo |
| --- | --- | --- |
| Web QA responde HTTP 200 | GREEN | Dominio publico disponible. |
| API responde JSON 404 controlado | YELLOW | Servicio responde, pero endpoint health no identificado. |
| PM2 online | GREEN | Procesos `api-linux`, `backend-reporteria-linux`, `flexi-api-qa`, `flexi-documental-qa` online. |
| Nginx OK | GREEN | `nginx -t` successful. |
| PostgreSQL activo | GREEN | Servicio activo y bases listadas. |
| Disco OK | GREEN | Root 14% usado. |
| Memoria OK | GREEN | 1.1 Gi disponible de 1.9 Gi total. |
| Node/npm instalados | GREEN | Node `v22.22.2`, npm `10.9.7`. |
| SSL valido | GREEN | Certificados vigentes. |
| System restart required | YELLOW | Reboot pendiente; no reiniciar sin ventana controlada. |
| SSL vence en julio 2026 | YELLOW | Certificados expiran el 2026-07-23 y 2026-07-27. |
| 5 sesiones SSH activas | YELLOW | Revisar sesiones antes de ventana de despliegue. |
| `manus_tienda` podria ser QA o ambiente compartido | YELLOW | Validar clasificacion antes de migrar. |
| Riesgos RED | RED | Ninguno observado en salidas sanitizadas. |

## Recomendacion

Resultado: `QA_AWS_DEPLOY_READY`

Listo para siguiente fase de backup/snapshot y despliegue controlado.

Condiciones antes de migrar o desplegar:

1. Tomar backup/snapshot.
2. Confirmar si `manus_tienda` es QA dedicado o ambiente compartido.
3. No ejecutar migraciones sin backup.
4. Planificar reboot en ventana controlada, no durante pre-check.
5. Renovar/monitorear SSL antes de julio 2026.

## Siguiente fase recomendada

Ejecutar fase de backup/snapshot y despliegue controlado QA cuando exista aprobacion humana explicita.

No ejecutar migraciones sin backup.

## Validaciones de cierre

- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS (`Change 'mvp-web-hardening' is valid`)
- `git diff --check`: PASS
- `git status --short`: `?? docs/evidencia-qa-aws-deployment-plan-mvp-00-2.md`; `?? docs/evidencia-qa-aws-environment-readiness-mvp-00.md`; `?? docs/evidencia-qa-aws-precheck-dryrun-mvp-00-3.md`; `?? openspec/changes/mvp-web-hardening/`
