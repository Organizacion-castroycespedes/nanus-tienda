# Evidencia QA - Backup real + env real QA MVP-00.4.5

## Objetivo

Ejecutar y documentar respaldos reales previos al bootstrap de `manus_tienda_qa`, y preparar el archivo env real fuera de git.

## Alcance

Esta fase permite respaldos reales, pero no permite crear `manus_tienda_qa`, ejecutar bootstrap, ejecutar migraciones, reiniciar servidor, desplegar, cambiar PM2, cambiar Nginx, cambiar PostgreSQL ni tocar PRD.

## Resultado

`QA_BACKUP_CONFIRMED`

Motivo: el operador humano ejecuto los respaldos reales previos al bootstrap QA y entrego evidencia sanitizada. Snapshot Lightsail, dump PostgreSQL, backup Nginx, backup PM2, backup env y env real QA fuera de git quedaron confirmados. Codex no ejecuto SSH ni comandos remotos.

## Snapshot Lightsail

| Campo | Resultado |
| --- | --- |
| Proveedor | AWS Lightsail |
| Instancia | `castroycespedes` |
| Snapshot creado | Si |
| Nombre snapshot | `castroycespedes-pre-manus-tienda-qa-bootstrap-20260610` |
| Fecha/hora | 2026-06-10, hora operativa no sensible |
| Responsable | Operador humano |
| Estado | Confirmado |
| Disco | 60 GB SSD |

No se usaron credenciales AWS en docs. El snapshot fue creado manualmente desde AWS Lightsail por operador humano.

## Ruta de backups

Ruta sugerida:

```text
/home/ubuntu/backups/manus-qa/YYYYMMDD-HHMM
```

Estructura esperada:

```text
db/
nginx/
pm2/
env/
logs/
```

Resultado: confirmada por operador humano.

Ruta real:

```text
/home/ubuntu/backups/manus-qa/20260610-0030
```

## Backup PostgreSQL

Base requerida:

- `manus_tienda`

Base opcional:

- `flexibuild_qa`

Comando planificado:

```bash
pg_dump -Fc -U manus_user -h localhost -d manus_tienda -f /home/ubuntu/backups/manus-qa/YYYYMMDD-HHMM/db/manus_tienda.dump
```

Validaciones planificadas:

- archivo existe
- tamaño > 0
- `pg_restore -l` lista contenido

Resultado: confirmado por operador humano.

Evidencia sanitizada:

- Archivo: `/home/ubuntu/backups/manus-qa/20260610-0030/db/manus_tienda.dump`
- Tamano: `487K`
- Validacion: `pg_restore -l OK`
- No se restauro dump.
- No se ejecutaron migraciones.

## Backup Nginx

Archivos/rutas planificados:

- `/etc/nginx/nginx.conf`
- `/etc/nginx/sites-enabled/`
- `/etc/nginx/sites-available/`

Destino planificado:

```text
/home/ubuntu/backups/manus-qa/YYYYMMDD-HHMM/nginx/
```

Resultado: confirmado por operador humano.

Evidencia sanitizada:

- Respaldo: `/home/ubuntu/backups/manus-qa/20260610-0030/nginx/nginx`
- No se modifico Nginx.

## Backup PM2

Comandos planificados de solo lectura:

```bash
pm2 list
pm2 describe api-linux
pm2 describe backend-reporteria-linux
```

Nota: no ejecutar `pm2 save` porque puede modificar estado.

Destino planificado:

```text
/home/ubuntu/backups/manus-qa/YYYYMMDD-HHMM/pm2/
```

Resultado: confirmado por operador humano.

Evidencia sanitizada:

- `/home/ubuntu/backups/manus-qa/20260610-0030/pm2/pm2-list.txt`
- `/home/ubuntu/backups/manus-qa/20260610-0030/pm2/api-linux.txt`
- `/home/ubuntu/backups/manus-qa/20260610-0030/pm2/backend-reporteria-linux.txt`
- No se ejecuto `pm2 save`.
- No se reinicio PM2.

## Backup env

Regla:

- localizar archivos env existentes sin imprimir contenido
- respaldar archivos env a carpeta segura
- no incluir secretos en docs, OpenSpec ni logs compartidos

Destino planificado:

```text
/home/ubuntu/backups/manus-qa/YYYYMMDD-HHMM/env/
```

Resultado: confirmado por operador humano.

Evidencia sanitizada:

- `/home/ubuntu/backups/manus-qa/20260610-0030/env/db.env.bak`
- No se pego contenido de `db.env`.
- No se guardaron secretos en docs/OpenSpec.

## Env real QA

Ruta esperada del archivo real no versionado:

```text
scripts/database/config/bootstrap-manus-tienda-qa.env
```

Estado local/repo:

- Archivo real existe: No.
- `.gitignore` protege `scripts/database/config/*.env`: Si.
- `.gitignore` permite `scripts/database/config/*.env.example`: Si.
- `git status --short` no muestra el env real: Si, porque no existe.
- En la instancia QA, `bootstrap-manus-tienda-qa.env` fue creado fuera de git.
- `git check-ignore` fue confirmado por operador humano.

Configuracion requerida cuando el humano lo prepare fuera de git:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=manus_tienda_qa
DB_OWNER=manus_qa_user
DB_ADMIN_USER=postgres
DB_ADMIN_PASSWORD=<set-outside-repo>
DB_APP_PASSWORD=<set-outside-repo>
CONFIRM_CREATE_QA_DB=NO
APPLY_OPTIONAL_FIXTURES=NO
RUN_SMOKE_SQL=YES
LOG_DIR=./logs
```

Confirmacion: `CONFIRM_CREATE_QA_DB=NO` debe mantenerse hasta la fase autorizada de bootstrap.

## Actualizacion manual recibida

Estado actualizado: `QA_BACKUP_CONFIRMED`.

Confirmado por operador humano:

- `db.env` fue respaldado manualmente fuera del repo.
- El repo de la instancia quedo preparado para `pull` sin perder configuracion sensible.
- No se pego contenido de `db.env` en docs, OpenSpec ni chat.
- Snapshot Lightsail creado: `castroycespedes-pre-manus-tienda-qa-bootstrap-20260610`.
- Backup root confirmado: `/home/ubuntu/backups/manus-qa/20260610-0030`.
- Dump `db/manus_tienda.dump` confirmado con tamano `487K`.
- `pg_restore -l` confirmado OK.
- Nginx respaldado en `nginx/nginx`.
- PM2 respaldado en `pm2-list.txt`, `api-linux.txt`, `backend-reporteria-linux.txt`.
- Env respaldado en `env/db.env.bak`.
- `bootstrap-manus-tienda-qa.env` creado fuera de git.
- `git check-ignore` confirmado.
- No se ejecuto bootstrap.
- No se creo `manus_tienda_qa`.
- No se ejecutaron migraciones.

## Validacion script con env seguro

No ejecutada.

Motivo: el script no tiene modo dry-run dedicado y el env real no existe. Ejecutarlo con `CONFIRM_CREATE_QA_DB=NO` bloquearia sin tocar DB, pero esta fase no requiere correr el script si no hay modo dry-run formal.

## Comandos manuales a ejecutar

Estos comandos son para ejecucion manual por operador humano dentro del servidor QA. No fueron ejecutados por Codex.

### 1. Variables de trabajo

```bash
export BACKUP_TS="$(date +%Y%m%d-%H%M)"
export BACKUP_ROOT="/home/ubuntu/backups/manus-qa/${BACKUP_TS}"
```

### 2. Crear carpeta de backups

```bash
mkdir -p "$BACKUP_ROOT"/{db,nginx,pm2,env,logs}
chmod 700 "$BACKUP_ROOT"
```

### 3. Dump PostgreSQL `manus_tienda`

Usar el metodo aprobado por el operador. No imprimir passwords.

```bash
pg_dump -Fc -U manus_user -h localhost -d manus_tienda -f "$BACKUP_ROOT/db/manus_tienda.dump"
```

### 4. Validar dump

```bash
test -s "$BACKUP_ROOT/db/manus_tienda.dump"
pg_restore -l "$BACKUP_ROOT/db/manus_tienda.dump" > "$BACKUP_ROOT/logs/manus_tienda.dump.list.txt"
wc -l "$BACKUP_ROOT/logs/manus_tienda.dump.list.txt"
```

### 5. Backup Nginx

```bash
sudo cp -a /etc/nginx/nginx.conf "$BACKUP_ROOT/nginx/"
sudo cp -a /etc/nginx/sites-enabled "$BACKUP_ROOT/nginx/"
sudo cp -a /etc/nginx/sites-available "$BACKUP_ROOT/nginx/"
sudo nginx -t > "$BACKUP_ROOT/logs/nginx-test.txt" 2>&1
```

### 6. Backup PM2

No ejecutar `pm2 save`.

```bash
pm2 list > "$BACKUP_ROOT/pm2/pm2-list.txt"
pm2 describe api-linux > "$BACKUP_ROOT/pm2/api-linux.describe.txt"
pm2 describe backend-reporteria-linux > "$BACKUP_ROOT/pm2/backend-reporteria-linux.describe.txt"
pm2 describe flexi-api-qa > "$BACKUP_ROOT/pm2/flexi-api-qa.describe.txt"
pm2 describe flexi-documental-qa > "$BACKUP_ROOT/pm2/flexi-documental-qa.describe.txt"
```

### 7. Backup env sin imprimir secretos

```bash
find /home/ubuntu -maxdepth 5 -type f \( -name ".env" -o -name "*.env" \) -print > "$BACKUP_ROOT/env/env-files-found.txt"
sudo tar -czf "$BACKUP_ROOT/env/env-files.tar.gz" -T "$BACKUP_ROOT/env/env-files-found.txt"
```

### 8. Preparar env real QA fuera de git

Ejecutar desde la raiz del repositorio remoto.

```bash
cp scripts/database/config/bootstrap-manus-tienda-qa.env.example scripts/database/config/bootstrap-manus-tienda-qa.env
chmod 600 scripts/database/config/bootstrap-manus-tienda-qa.env
```

Editar el archivo real con secretos fuera de docs/OpenSpec. Mantener:

```env
CONFIRM_CREATE_QA_DB=NO
```

Validar sin imprimir secretos:

```bash
grep '^DB_NAME=' scripts/database/config/bootstrap-manus-tienda-qa.env
grep '^CONFIRM_CREATE_QA_DB=' scripts/database/config/bootstrap-manus-tienda-qa.env
git check-ignore -v scripts/database/config/bootstrap-manus-tienda-qa.env
git status --short -- scripts/database/config/bootstrap-manus-tienda-qa.env
```

Validaciones de repositorio:

```powershell
openspec.cmd validate mvp-web-hardening --type change --strict
git diff --check
git status --short
```

Resultados:

- OpenSpec: PASS, `Change 'mvp-web-hardening' is valid`.
- `git diff --check`: PASS con warning CRLF en `.gitignore`.
- `git status --short`: PASS informativo; no aparece `scripts/database/config/bootstrap-manus-tienda-qa.env`.
- En MVP-00.4.5A no se ejecuto SSH ni backups remotos.
- `docs/checklist-exec-backup-qa.md` creado para ejecucion manual por operador humano.

## Riesgos

- Validar que el snapshot sea retenido hasta terminar bootstrap QA y smoke remoto.
- Mantener `CONFIRM_CREATE_QA_DB=NO` hasta la fase explicita de bootstrap.
- No ejecutar bootstrap ni migraciones hasta aprobacion humana de MVP-00.4.6 o fase equivalente.

## Restricciones cumplidas

- No bootstrap ejecutado.
- No se creo `manus_tienda_qa`.
- No migraciones ejecutadas.
- No se toco `manus_tienda`.
- No se reinicio servidor.
- No deploy.
- No cambios PM2.
- No cambios Nginx.
- No cambios PostgreSQL.
- No PRD.
- No secretos en docs/OpenSpec.

## Siguiente paso recomendado

1. Preparar fase siguiente autorizada para bootstrap controlado de `manus_tienda_qa`.
2. Mantener `CONFIRM_CREATE_QA_DB=NO` hasta el inicio aprobado de esa fase.
3. No avanzar si falta aprobacion humana explicita.
