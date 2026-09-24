# Matriz de contratos frontend-backend

Commit auditado: `3dd5098f428e23daf31c750d638c0adb2fa8676a`. La tabla muestra
contratos consumidos por Web, no todos los endpoints existentes en backend.

| Consumidor Web | Cliente | Contrato observado | Contexto | Evidencia y estado |
|---|---|---|---|---|
| Login y recuperacion | `web/domains/auth/api.ts` | `POST /auth/login`, logout, forgot/reset y reemplazo de sesion | Credenciales; sesion posterior | Codigo confirmado; respuesta no ejecutada |
| Bootstrap identidad | `session-manager.ts` | `GET /auth/me`, `/me/menu`, `/me/permissions` | Bearer JWT | Codigo confirmado; guards backend en B2.1 |
| Refresh | `session-manager.ts` + `lib/http.ts` | `POST /auth/refresh` y reintento unico | Refresh token + Bearer nuevo | Codigo confirmado; rotacion efectiva depende de API |
| Contexto POS | `web/domains/pos/api.ts` | `GET /auth/context`, `POST /pos/session`, `GET /pos/session/current` | Tenant, sucursal, terminal, sesion POS | Codigo confirmado; integridad por ambiente pendiente |
| Venta POS | `web/modules/pos/services/pos.service.ts` | Productos, clientes, impuestos, `POST /sales`, idempotencia y preview | `x-pos-session-id` cuando aplica | Codigo confirmado; E2E no ejecutado |
| Inventario y dominios | `web/modules/inventory/`, `web/domains/products/` | Productos, stock, compras, lotes, impuestos y unidades | Bearer; filtros de dominio | Servicios observados; contraste endpoint por endpoint pendiente |
| Reporteria | `reporting.service.ts`, `product-inventory-report.service.ts` | `/reports/...` para PDF, Excel, tickets, caja, ventas, compras y BI | `NEXT_PUBLIC_REPORTS_API_BASE_URL`; POS session cuando aplica | Web -> reporteria directo confirmado; disponibilidad no probada |
| Entregas | `web/modules/deliveries/services/deliveries.service.ts` | CRUD por API general y ticket por base de reportes | Bearer y POS donde aplica | Mezcla de bases confirmada; E2E pendiente |
| Perifericos Web | `web/domains/peripherals/` | Agent HTTP/WS; eventos scanner y acciones de impresion/cajon/bascula | Flags y URLs publicas de cliente | Configurado; hardware real y red no verificados |
| Perifericos Electron | `window.manusTerminal` | IPC hacia Agent: health, devices, print, drawer, scale y logs | Solo Electron | Bridge y cliente local confirmados; instalada no probada |

## Configuracion de URLs

`web/.env.example#L1-L32` declara `NEXT_PUBLIC_API_BASE_URL`,
`NEXT_PUBLIC_REPORTS_API_BASE_URL`, `API_PROXY_TARGET` y URLs HTTP/WS del
Agent. Son nombres de variables, no secretos. La configuracion no prueba que
los destinos esten disponibles en QA o produccion.

## Limites

El layout y los permisos Web restringen navegacion, pero la autoridad debe
permanecer en la API. No se confirma acceso directo del navegador al proceso
Electron. No se confirma offline, auto-update, impresion fisica certificada ni
transmision fiscal productiva.
