# Docker local (backends) — onboarding

Config compartida para desarrollo local en Windows. **Postgres, web, periféricos y Electron corren en el host.** Solo los backends Nest van en Docker.

## Contrato de puertos (igual en cada PC)

| Proceso | Dónde | Puerto |
| --- | --- | --- |
| `web` (`next dev`) | Host | `3000` |
| `api` | Docker | `4020` |
| `backend-reporteria` | Docker | `4021` |
| `backend-facturacion-electronica` | Docker | `4030` |
| PostgreSQL | Host | `5432` |
| `backend-perifericos` | Host | `4050` (`127.0.0.1`) |
| Electron | Host | carga `http://localhost:3000` |

Bases:

- `manus_tienda` — API + reportería
- `manus_tienda_electronic_billing` — facturación electrónica

JWT: el mismo valor en API y reportería (variable `JWT_SECRET` del `.env` raíz).

CORS: `http://localhost:3000`.

## Requisitos

1. Docker Desktop (WSL2 recomendado).
2. Node.js 18+ (web y periféricos en el host).
3. PostgreSQL 16+ en el host, escuchando en `5432`.
4. Git Bash o WSL para migraciones (`scripts/database/migrate.sh`).

## Setup del compañero (una vez)

### 1. Clonar y copiar env

```powershell
cd L:\Proyectos\sociedad\nanus-tienda
copy .env.docker.example .env
copy web\.env.example web\.env.local
```

Editar `.env` raíz:

- `DB_PASSWORD` — password real de tu Postgres local
- `JWT_SECRET` — cualquier secreto local (mismo para API y reportería)

Opcional: copiar `scripts/config/db.env.example` → `scripts/config/db.env` para migraciones.

### 2. Bases y migraciones (en el host)

Crear las dos bases en tu Postgres. Luego:

```bash
bash scripts/database/migrate.sh scripts/config/db.env
bash scripts/database/seed.sh scripts/config/db.env
```

Las migraciones **no** se ejecutan desde el contenedor.

### 3. Abrir Postgres a Docker

Los contenedores usan `DB_HOST=host.docker.internal`.

Checklist Windows:

1. En `postgresql.conf`: `listen_addresses = '*'` (o confirmar que Docker Desktop llega a `127.0.0.1:5432`).
2. En `pg_hba.conf`, permitir la red Docker, por ejemplo:
   ```text
   host all all 172.16.0.0/12 scram-sha-256
   host all all 192.168.0.0/16 scram-sha-256
   ```
3. Reiniciar el servicio PostgreSQL.
4. Firewall de Windows: permitir puerto `5432` desde vEthernet / WSL si hace falta.

Prueba rápida desde un contenedor:

```powershell
docker compose run --rm api node -e "require('net').connect(5432,'host.docker.internal',()=>console.log('ok')).on('error',e=>{console.error(e);process.exit(1)})"
```

(Eso requiere que la imagen `api` ya esté construida; si falla, primero `docker compose build api`.)

### 4. Levantar backends

```powershell
docker compose up --build
```

Primera vez instala `node_modules` dentro de volúmenes nombrados (Linux). Puede tardar.

Servicios:

- API: `http://localhost:4020`
- Reportería: `http://localhost:4021/api/reports/health`
- Facturación: `http://localhost:4030`

### 5. Web en el host (siempre)

La web **no** va en Docker (hot reload nativo, sin rebuild de imagen).

```powershell
cd web
npm install
npm run dev
```

Abrir `http://localhost:3000`.

`web/.env.local` debe tener:

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api`
- `API_PROXY_TARGET=http://localhost:4020`
- `NEXT_PUBLIC_REPORTS_API_BASE_URL=http://localhost:4021/api`
- periféricos en `http://localhost:4050`

### 6. Periféricos físicos (host)

USB / impresora / cajón / scanner no son fiables dentro de Docker en Windows. El agent vive en el host:

```powershell
cd backend-perifericos
copy .env.example .env
npm install
npm run start:dev
```

Defaults útiles:

- Bind `127.0.0.1:4050`
- `PERIPHERALS_ALLOWED_ORIGINS` incluye `http://localhost:3000`
- Hardware real: `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`

### 7. Electron (opcional)

Con la web en `:3000`:

```powershell
cd desktop\electron
npm install
$env:MANUS_WEB_URL="http://localhost:3000"
npm run dev
```

## Día a día

1. Postgres del host encendido.
2. `docker compose up` (o `up -d`).
3. `cd web && npm run dev`.
4. Si hay POS físico: `cd backend-perifericos && npm run start:dev`.
5. Abrir `http://localhost:3000`.

Parar backends:

```powershell
docker compose down
```

## Smoke checklist

- [ ] `http://localhost:4020` responde
- [ ] `http://localhost:4021/api/reports/health` → 200
- [ ] `http://localhost:4030/health` responde (`status: ok`)
- [ ] `http://localhost:4050` (agent host, si lo usas)
- [ ] Login en `http://localhost:3000`
- [ ] Ticket / cajón contra hardware real (si aplica)

## Qué no va en Docker

- PostgreSQL
- `web` (Next.js)
- `backend-perifericos`
- Electron

## Troubleshooting

| Síntoma | Qué mirar |
| --- | --- |
| API no conecta a Postgres | `DB_PASSWORD` en `.env`, `pg_hba.conf`, firewall, `host.docker.internal` |
| CORS bloqueado | Origen debe ser `http://localhost:3000` |
| Reportería 401 | Mismo `JWT_SECRET` que la API |
| Web no llega al API | `API_PROXY_TARGET=http://localhost:4020` y rewrite de Next |
| Periféricos fallan | Agent en host `:4050`, no dentro de Docker |
| Hot reload lento en API | Normal en bind mounts Windows; usa Docker Desktop WSL2 |

## Archivos de referencia

- [`.env.docker.example`](../.env.docker.example) → `.env` raíz (compose)
- [`docker-compose.yml`](../docker-compose.yml)
- [`web/.env.example`](../web/.env.example) → `web/.env.local`
- [`backend-perifericos/.env.example`](../backend-perifericos/.env.example)
