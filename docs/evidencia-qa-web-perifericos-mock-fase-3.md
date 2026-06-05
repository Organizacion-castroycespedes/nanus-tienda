# Evidencia QA - Web perifericos MOCK - Fase 3

## Objetivo

Integrar Manus POS Web con `backend-perifericos` en modo `MOCK/SIMULATOR` mediante una pantalla administrativa de diagnostico y configuracion tecnica.

## Alcance

- Ruta web creada: `/[tenant]/admin/peripherals`.
- HTTP local configurable contra `backend-perifericos`.
- WebSocket local configurable contra `backend-perifericos`.
- Vista de health, devices, acciones mock, peso, scanner, logs y eventos.
- Manejo visual de agent offline.
- Sin hardware real.
- Sin Electron.
- Sin Capacitor.
- Sin cambios en core de ventas, inventario, compras, caja ni facturacion.

## Archivos modificados o creados

- `web/app/[tenant]/admin/peripherals/page.tsx`
- `web/domains/peripherals/api.ts`
- `web/domains/peripherals/types.ts`
- `web/domains/peripherals/components/PeripheralsPage.tsx`
- `web/.env.example`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`
- `docs/evidencia-qa-web-perifericos-mock-fase-3.md`

## Variables de entorno

Next.js usa variables publicas con prefijo `NEXT_PUBLIC_`.

```env
NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL=http://localhost:4050
NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL=ws://localhost:4050/peripherals
```

No se usaron `VITE_*` porque el frontend real es Next.js.

## Como levantar backend-perifericos

```powershell
cd backend-perifericos
npm.cmd run dev
```

URL esperada:

- HTTP: `http://localhost:4050`
- WebSocket: `ws://localhost:4050/peripherals`

## Como levantar web

```powershell
cd web
npm.cmd run dev
```

Ruta de prueba:

```text
http://localhost:3000/00000000-0000-0000-0000-000000000001/admin/peripherals
```

La ruta queda accesible por URL. Alta en menu/RBAC backend queda pendiente porque esta fase no toca `api/`.

## Pruebas realizadas

### Build backend-perifericos

Comando:

```powershell
cd backend-perifericos
npm.cmd run build
```

Resultado: `PASS`.

### Tests backend-perifericos

Comando:

```powershell
cd backend-perifericos
npm.cmd test
```

Resultado: `PASS`.

Resumen:

- 18 tests ejecutados.
- 18 tests pasaron.
- 0 fallos.

### Build web

Comando:

```powershell
cd web
npm.cmd run build
```

Resultado: `PASS`.

La ruta `/[tenant]/admin/peripherals` fue incluida en el build.

Warnings observados: warnings preexistentes de ESLint en pantallas como `app/login/page.tsx`, `app/[tenant]/configuracion/page.tsx`, `app/[tenant]/layout.tsx`, `app/[tenant]/purchases/page.tsx`, `app/[tenant]/roles/page.tsx`, `app/[tenant]/usuarios/page.tsx` y `components/landing/HowItWorks.tsx`.

### Tests frontend

No se ejecuto `npm.cmd test` en `web/` porque `web/package.json` no define script `test`.

### Smoke HTTP backend-perifericos

Se levanto temporalmente `node dist/main.js` y se detuvo al finalizar.

Resultados:

- `GET /health`: `200`
- `GET /devices`: `200`
- `POST /printer/test-print`: `201`
- `POST /cash-drawer/open`: `201`
- `GET /scale/current-weight`: `200`
- `POST /scanner/simulate`: `201`
- `GET /logs`: `200`

### Browser smoke

Se intento abrir la ruta web con Browser plugin. El runtime de navegador fallo por sandbox local:

```text
node_repl kernel exited unexpectedly
windows sandbox failed: spawn setup refresh
```

No se bloqueo la entrega porque `npm.cmd run build` genero la ruta correctamente y el smoke HTTP del agent paso.

## Validacion OpenSpec

Comando:

```powershell
openspec.cmd validate add-pos-peripherals-platform --type change --strict
```

Resultado: `PASS`.

Salida:

```text
Change 'add-pos-peripherals-platform' is valid
```

## git diff --check

Comando:

```powershell
git diff --check
```

Resultado: `PASS`.

Nota: Git reporto normalizacion futura LF -> CRLF para `web/.env.example`, sin fallar el comando.

## Riesgos pendientes

- La ruta no esta agregada al menu dinamico ni a RBAC backend para evitar tocar `api/`.
- La vista depende de que el navegador permita conectar contra `localhost:4050`.
- La validacion real de WebSocket en navegador queda pendiente por fallo del Browser runtime local.
- Integracion con flujo real de venta POS queda fuera de alcance de esta fase.
- Electron, Capacitor y hardware real siguen fuera de alcance.

## Confirmaciones

- No se conecto hardware real.
- No se agregaron drivers ESC/POS, serialport, USB ni HID.
- No se crearon migraciones.
- No se modifico `database/`.
- No se modifico `backend-reporteria/`.
- No se modifico `api/`.
- No se modifico core de ventas, inventario, compras, caja ni facturacion.
