# Checklist ejecucion manual backup QA

Estado: `PENDING_EXECUTION`.

Uso: este checklist es para operador humano. Codex no debe ejecutar SSH ni comandos remotos.

## Datos confirmados

- Proveedor: AWS Lightsail.
- Instancia: `castroycespedes`.
- Host interno: `ip-172-26-15-126`.
- SO: Ubuntu 24.04.4 LTS.
- PM2: online.
- Nginx: OK.
- PostgreSQL: activo.
- Base QA actual: `manus_tienda`.
- Base futura aislada: `manus_tienda_qa`.

## Checklist operativo

- [ ] Crear snapshot Lightsail desde consola AWS.
- [ ] Registrar nombre snapshot.
- [ ] Registrar fecha/hora.
- [ ] Registrar responsable.
- [ ] Crear carpeta backups.
- [ ] Crear dump `manus_tienda`.
- [ ] Validar dump existe.
- [ ] Validar dump tamaño > 0.
- [ ] Validar `pg_restore -l`.
- [ ] Backup Nginx.
- [ ] Backup PM2 sin ejecutar `pm2 save`.
- [ ] Backup env sin imprimir secretos.
- [ ] Preparar env real `scripts/database/config/bootstrap-manus-tienda-qa.env`.
- [ ] Verificar `CONFIRM_CREATE_QA_DB=NO`.
- [ ] Verificar que env real queda ignorado por git.
- [ ] Entregar salidas sanitizadas para evidencia.

## Comandos manuales a ejecutar

No ejecutar desde Codex. Ejecutar manualmente en QA AWS.

### 1. Snapshot Lightsail

Crear desde consola AWS Lightsail:

```text
Instancia: castroycespedes
Nombre sugerido: castroycespedes-pre-bootstrap-qa-YYYYMMDD-HHMM
```

Registrar:

```text
Snapshot name:
Fecha/hora:
Responsable:
Estado:
```

### 2. Crear carpeta backups

```bash
export BACKUP_TS="$(date +%Y%m%d-%H%M)"
export BACKUP_ROOT="/home/ubuntu/backups/manus-qa/${BACKUP_TS}"
mkdir -p "$BACKUP_ROOT"/{db,nginx,pm2,env,logs}
chmod 700 "$BACKUP_ROOT"
echo "$BACKUP_ROOT"
```

### 3. Dump `manus_tienda`

No imprimir passwords.

```bash
pg_dump -Fc -U manus_user -h localhost -d manus_tienda -f "$BACKUP_ROOT/db/manus_tienda.dump"
```

### 4. Validar dump

```bash
test -s "$BACKUP_ROOT/db/manus_tienda.dump"
ls -lh "$BACKUP_ROOT/db/manus_tienda.dump"
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

### 7. Backup env

No imprimir contenido de env.

```bash
find /home/ubuntu -maxdepth 5 -type f \( -name ".env" -o -name "*.env" \) -print > "$BACKUP_ROOT/env/env-files-found.txt"
sudo tar -czf "$BACKUP_ROOT/env/env-files.tar.gz" -T "$BACKUP_ROOT/env/env-files-found.txt"
ls -lh "$BACKUP_ROOT/env/"
```

### 8. Preparar env real QA

Ejecutar desde la raiz del repo remoto.

```bash
cp scripts/database/config/bootstrap-manus-tienda-qa.env.example scripts/database/config/bootstrap-manus-tienda-qa.env
chmod 600 scripts/database/config/bootstrap-manus-tienda-qa.env
```

Editar valores reales fuera de git. Mantener:

```env
DB_NAME=manus_tienda_qa
CONFIRM_CREATE_QA_DB=NO
APPLY_OPTIONAL_FIXTURES=NO
RUN_SMOKE_SQL=YES
```

Validar sin secretos:

```bash
grep '^DB_NAME=' scripts/database/config/bootstrap-manus-tienda-qa.env
grep '^CONFIRM_CREATE_QA_DB=' scripts/database/config/bootstrap-manus-tienda-qa.env
git check-ignore -v scripts/database/config/bootstrap-manus-tienda-qa.env
git status --short -- scripts/database/config/bootstrap-manus-tienda-qa.env
```

## Salidas sanitizadas a entregar

- Nombre snapshot.
- Fecha/hora snapshot.
- Responsable.
- Ruta `BACKUP_ROOT`.
- `ls -lh "$BACKUP_ROOT/db/manus_tienda.dump"`.
- Conteo de `wc -l "$BACKUP_ROOT/logs/manus_tienda.dump.list.txt"`.
- Resultado de `sudo nginx -t` desde archivo log, sin secretos.
- Archivos PM2 generados.
- Confirmacion de env real con `CONFIRM_CREATE_QA_DB=NO`.
- Confirmacion de `git check-ignore`.

## Stop conditions

- No crear `manus_tienda_qa`.
- No ejecutar `bootstrap-manus-tienda-qa.sh`.
- No ejecutar migraciones.
- No reiniciar.
- No deploy.
- No tocar PRD.
