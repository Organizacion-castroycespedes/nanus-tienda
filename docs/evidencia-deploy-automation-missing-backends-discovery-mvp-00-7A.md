# Evidencia - Deploy Automation + Missing Backends Discovery - MVP-00.7A

Fecha: 2026-06-10

Cambio OpenSpec: `mvp-web-hardening`

Fase: `MVP-00.7A - Deploy Automation + Missing Backends Discovery`

Resultado: `QA_DEPLOY_AUTOMATION_DISCOVERY_READY`

## Objetivo

Disenar e inventariar la automatizacion futura de build/deploy hacia QA AWS para la rama oficial QA:

- `release/evolutivo/0.0.1`

Tambien confirmar el estado de los backends faltantes:

- `backend-facturacion-electronica`
- `backend-perifericos`

Esta fase no ejecuta deploy, no toca AWS, no modifica secretos, no crea GitHub secrets reales, no compila y no reinicia PM2.

## Alcance

Solo documentacion e inventario local:

- estructura repo,
- package scripts,
- runtime objetivo,
- PM2 objetivo,
- GitHub Actions objetivo,
- smoke tests objetivo,
- riesgos y siguientes pasos.

## Rama Local Observada

La rama local observada al inventariar fue:

- `feat/develop/mvp-deploy-backends`

La rama QA oficial para automatizacion queda definida como:

- `release/evolutivo/0.0.1`

No se cambio de rama.

## Inventario Repo

| Servicio | Ruta | Existe | Tipo | Build actual | Binario pkg actual |
| --- | --- | --- | --- | --- | --- |
| API principal | `api/` | Si | NestJS | `npm run build` | `npm run build:bin` |
| Reporteria | `backend-reporteria/` | Si | NestJS | `npm run build` | `npm run build:bin` |
| Facturacion electronica | `backend-facturacion-electronica/` | Si | NestJS | `npm run build` | No existe |
| Perifericos | `backend-perifericos/` | Si | NestJS | `npm run build` | No existe |
| Web | `web/` | Si | Next.js/Vercel | `npm run build` | No aplica |

Package files revisados:

- `api/package.json`
- `backend-reporteria/package.json`
- `backend-facturacion-electronica/package.json`
- `backend-perifericos/package.json`
- `web/package.json`

## Scripts Relevantes

### `api/`

- `start:dev`: `tsx watch src/main.ts`
- `build`: `tsc -p tsconfig.json`
- `start`: `node dist/main.js`
- `build:bin`: `npm run build && pkg . --compress Brotli`
- `pkg.outputPath`: `dist-bin`
- targets: `node18-linux-x64`, `node18-win-x64`

### `backend-reporteria/`

- `start:dev`: `tsx watch src/main.ts`
- `build`: `tsc -p tsconfig.json`
- `start`: `node dist/main.js`
- `build:bin`: `npm run build && pkg . --compress Brotli`
- `pkg.outputPath`: `dist-bin`
- targets: `node18-linux-x64`, `node18-win-x64`

### `backend-facturacion-electronica/`

- `start:dev`: `tsx watch src/main.ts`
- `build`: `tsc -p tsconfig.build.json`
- `start`: `node dist/main.js`
- `test`: `tsx --test "test/**/*.spec.ts"`
- No tiene `build:bin`.
- No tiene configuracion `pkg`.
- Default port actual: `PORT` o `4030`.
- Health: `GET /health`.

### `backend-perifericos/`

- `dev`: `tsx watch src/main.ts`
- `start:dev`: `tsx watch src/main.ts`
- `build`: `tsc -p tsconfig.build.json`
- `start`: `node dist/main.js`
- `test`: `tsx --test "test/**/*.spec.ts"`
- No tiene `build:bin`.
- No tiene configuracion `pkg`.
- Default port actual: `PERIPHERALS_PORT` o `4050`.
- Health: `GET /health`.
- Bind actual: `127.0.0.1`.
- Default real adapters: `PERIPHERALS_ENABLE_REAL_ADAPTERS=false`.

## Estado Backends Faltantes

### `backend-facturacion-electronica`

Estado: existe, no hay que crearlo desde cero.

Esta completo como servicio NestJS base para QA:

- tiene `src/main.ts`;
- tiene `src/modules/health`;
- tiene `src/modules/fiscal-lookup`;
- tiene tests;
- tiene `.env.example`;
- tiene README.

Gap para deploy binario:

- falta `build:bin`;
- falta configuracion `pkg`;
- falta decidir si QA lo corre como binario o como `node dist/main.js`.

Decision recomendada:

- MVP-00.7B debe agregar packaging binario para alinear con `api-linux` y `backend-reporteria-linux`, o documentar runtime Node dist como excepcion controlada.

### `backend-perifericos`

Estado: existe, no hay que crearlo desde cero.

Esta completo como servicio NestJS MOCK:

- tiene `src/main.ts`;
- tiene `src/modules/health`;
- tiene impresora, caja, scanner, balanza, devices y logs;
- tiene tests;
- tiene `.env.example`;
- tiene README.

Gap para deploy binario:

- falta `build:bin`;
- falta configuracion `pkg`;
- debe seguir con `PERIPHERALS_ENABLE_REAL_ADAPTERS=false`.

Decision recomendada:

- MVP-00.7B debe agregar packaging binario o usar runtime Node dist.
- En QA AWS debe mantenerse MOCK. No usar hardware real.

## Arquitectura QA AWS Objetivo

Servicios locales en Ubuntu + PM2:

| Servicio | Proceso PM2 objetivo | Puerto QA | Health |
| --- | --- | ---: | --- |
| API principal | `api-linux` | `4020` | `/api/system/version` |
| Reporteria | `backend-reporteria-linux` | `4021` | `/api/reports/health` |
| Facturacion electronica | `backend-facturacion-electronica-linux` | `4022` | `/health` |
| Perifericos MOCK | `backend-perifericos-linux` | `4023` | `/health` |

Notas:

- `backend-facturacion-electronica` default local es `4030`; QA debe setear `PORT=4022`.
- `backend-perifericos` default local es `4050`; QA debe setear `PERIPHERALS_PORT=4023`.
- `backend-perifericos` debe mantener `PERIPHERALS_ENABLE_REAL_ADAPTERS=false`.
- `backend-perifericos` debe seguir escuchando en `127.0.0.1` salvo decision explicita de exponer health por Nginx.

## Runtime QA Objetivo

Rutas objetivo:

```text
/home/ubuntu/manustienda/build
/home/ubuntu/manustienda/build-reporteria
/home/ubuntu/manustienda/build-facturacion-electronica
/home/ubuntu/manustienda/build-perifericos
```

Convencion propuesta por servicio:

```text
current/
releases/YYYYMMDD-HHMMSS/
backups/YYYYMMDD-HHMMSS/
logs/
.env
```

Si se mantiene binario:

```text
current/api-linux
current/backend-reporteria-linux
current/backend-facturacion-electronica-linux
current/backend-perifericos-linux
```

Si se usa `dist` para servicios sin pkg:

```text
current/dist/main.js
current/package.json
current/package-lock.json
current/node_modules/
```

Decision recomendada:

- Unificar a binarios `pkg` para los cuatro backends, porque QA hoy ya opera con binarios manuales para API y reporteria.

## PM2 Objetivo

Procesos:

| Proceso | cwd | script | env clave |
| --- | --- | --- | --- |
| `api-linux` | `/home/ubuntu/manustienda/build/current` | `./api-linux` | `PORT=4020` |
| `backend-reporteria-linux` | `/home/ubuntu/manustienda/build-reporteria/current` | `./backend-reporteria-linux` | `PORT=4021` |
| `backend-facturacion-electronica-linux` | `/home/ubuntu/manustienda/build-facturacion-electronica/current` | `./backend-facturacion-electronica-linux` | `PORT=4022` |
| `backend-perifericos-linux` | `/home/ubuntu/manustienda/build-perifericos/current` | `./backend-perifericos-linux` | `PERIPHERALS_PORT=4023` |

Estrategia:

- PM2 centralizado recomendado: `/home/ubuntu/manustienda/ecosystem.qa.config.js`.
- `autorestart=true`.
- `watch=false`.
- `max_memory_restart=500M` para API/reporteria; `300M` para FE/perifericos si memoria QA queda limitada.
- Logs por servicio en `/home/ubuntu/manustienda/logs/<service>/`.
- Restart controlado: `pm2 restart <name> --update-env` solo despues de reemplazo atomico y smoke previo local si aplica.

No se creo ni modifico ecosystem real.

## GitHub Actions Objetivo

Trigger:

```yaml
on:
  push:
    branches:
      - release/evolutivo/0.0.1
```

Jobs propuestos:

1. Checkout.
2. Setup Node.
3. Build API:
   - `cd api`
   - `npm ci`
   - `npm run build:bin`
4. Build reporteria:
   - `cd backend-reporteria`
   - `npm ci`
   - `npm run build:bin`
5. Build facturacion electronica:
   - si existe `build:bin`, ejecutar `npm run build:bin`;
   - si no existe, bloquear deploy o crear bundle `dist` controlado.
6. Build perifericos:
   - si existe `build:bin`, ejecutar `npm run build:bin`;
   - si no existe, bloquear deploy o crear bundle `dist` controlado.
7. Empaquetar artefactos.
8. SSH pre-check remoto:
   - verificar disco;
   - verificar PM2;
   - verificar rutas;
   - verificar env existe sin imprimir contenido.
9. Backup binarios actuales:
   - mover/copiar `current` a `backups/<timestamp>`.
10. Upload por SCP a `releases/<timestamp>`.
11. Reemplazo atomico:
   - apuntar `current` a release nueva con symlink o rename atomico.
12. `chmod +x` para binarios.
13. `pm2 restart <name> --update-env`.
14. Smoke tests.
15. Rollback automatico si smoke falla:
   - volver `current` a backup anterior;
   - `pm2 restart`;
   - registrar fallo.

No se creo workflow real en esta fase.

## GitHub Secrets Requeridos

No se crearon secrets reales.

Secrets necesarios:

| Secret | Uso |
| --- | --- |
| `QA_SSH_HOST` | Host/IP QA AWS |
| `QA_SSH_USER` | Usuario SSH QA |
| `QA_SSH_PRIVATE_KEY` | Llave privada SSH deploy |
| `QA_DEPLOY_BASE_PATH` | Base path, por ejemplo `/home/ubuntu/manustienda` |
| `QA_API_BASE_URL` | URL publica API QA, por ejemplo `https://api.apptiendamanus.space` |

Secrets recomendados adicionales para fase de implementacion:

| Secret | Uso |
| --- | --- |
| `QA_SSH_PORT` | Puerto SSH si no es 22 |
| `QA_DEPLOY_KNOWN_HOSTS` | Host key pinning |
| `QA_SMOKE_AUTH_TOKEN` | Token QA solo si smoke protegido lo requiere |

Reglas:

- No guardar secretos en repo.
- No imprimir secretos en logs.
- No subir `.env`.
- Validar `known_hosts` para evitar SSH MITM.

## Smoke Tests Objetivo

Infra local en servidor despues de PM2:

```bash
curl -fsS http://127.0.0.1:4020/api/system/version
curl -fsS http://127.0.0.1:4022/health
curl -fsS http://127.0.0.1:4023/health
```

Reporteria:

```bash
curl -fsS http://127.0.0.1:4021/api/reports/health
```

Nota:

- `backend-reporteria` tiene guards en `ReportsController`; si el health requiere auth en QA, el smoke debe usar token QA o se debe crear health publico en fase separada.

Smoke remoto publico:

```bash
curl -fsS https://api.apptiendamanus.space/api/system/version
curl -fsS https://api.apptiendamanus.space/api/reports/health
```

Facturacion electronica y perifericos:

- Si Nginx no los expone, smoke debe ser local por SSH.
- Si se exponen, definir rutas Nginx explicitas antes:
  - `/api/electronic-invoicing-service/`
  - `/api/peripherals-agent/`

## Nginx Objetivo

Estado conocido anterior:

- `/` proxy a `http://localhost:4020`
- `/api/reports/` proxy a `http://localhost:4021/api/reports/`

Propuesta futura, no aplicada:

- mantener API principal en `4020`;
- mantener reporteria en `4021`;
- exponer facturacion electronica solo si se necesita consumo remoto;
- mantener perifericos preferiblemente interno/local por seguridad.

No se modifico Nginx.

## Rollback Objetivo

Rollback por servicio:

1. Detectar smoke fallido.
2. Reapuntar `current` a backup anterior.
3. Ejecutar `pm2 restart <service> --update-env`.
4. Repetir smoke.
5. Registrar evidencia.

Rollback no debe tocar DB.

## Riesgos

- `backend-facturacion-electronica` y `backend-perifericos` existen, pero no tienen `build:bin`; si se exige binario, falta implementacion.
- `backend-reporteria` health puede requerir auth por guards actuales.
- La instancia QA tiene 2 GB RAM; correr cuatro backends PM2 requiere vigilar memoria.
- `backend-perifericos` remoto no debe activar hardware real.
- No existe `.github/workflows` actualmente; la automatizacion GitHub Actions sera nueva en fase posterior.
- `api/ecosystem.config.js` existe, pero usa nombre `manus-api`; QA confirmado usa `api-linux`. Hay que estandarizar nombres antes de aplicar.
- No se validaron binarios porque esta fase no compila.

## Siguiente Paso Recomendado

MVP-00.7B:

- definir si los cuatro backends se despliegan como binarios `pkg`;
- agregar `build:bin` a `backend-facturacion-electronica` y `backend-perifericos` si se aprueba;
- crear workflow GitHub Actions en modo controlado;
- crear ecosystem QA versionado sin secretos;
- probar build local antes de habilitar deploy real.

## Validaciones

Comandos ejecutados localmente:

```bash
openspec.cmd validate mvp-web-hardening --type change --strict
git diff --check
git status --short
```

Resultados:

- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS, `Change 'mvp-web-hardening' is valid`.
- `git diff --check`: PASS. Git emitio warning LF -> CRLF para `openspec/changes/mvp-web-hardening/tasks.md`.
- `git status --short`: PASS. Cambios esperados:
  - `M openspec/changes/mvp-web-hardening/tasks.md`
  - `?? docs/evidencia-deploy-automation-missing-backends-discovery-mvp-00-7A.md`

## Restricciones Cumplidas

- No se ejecuto deploy.
- No se toco AWS.
- No se modificaron secretos.
- No se crearon GitHub secrets reales.
- No se compilo.
- No se reinicio PM2.
- No se modifico Nginx.
- No se modifico PostgreSQL.
- No se toco PRD.
