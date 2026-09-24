# Manus Web: arquitectura AS-IS

Estado: B3 documental. Commit auditado: `3dd5098f428e23daf31c750d638c0adb2fa8676a`.

## Identificacion

El frontend es una aplicacion Next.js 14.2.3 con React 18.2.0, App Router,
Redux Toolkit y `react-redux`. Evidencia: `web/package.json#L1-L33`.
El layout raiz monta `Providers`, conectividad y estilos globales
(`web/app/layout.tsx#L1-L21`).

## Composicion y rutas

- `web/app/`: rutas App Router y layouts publicos y tenant.
- `web/components/`: componentes compartidos y autenticacion.
- `web/domains/`: auth, POS, productos, menu, usuarios, roles, sucursales,
  ubicaciones, parametros y perifericos.
- `web/modules/`: POS, inventario, ventas, compras, entregas, finanzas,
  promociones, terminales, reporteria y facturacion electronica.
- `web/store/`: slices y store Redux.
- `web/lib/`: clientes HTTP y utilidades transversales.

Rutas publicas confirmadas: `/`, `/login`, `/forgot-password` y
`/unauthorized`. `[tenant]` contiene dashboard, usuarios, roles, menu,
configuracion, terminales, clientes, proveedores, pedidos, compras, entregas,
inventario, operaciones, POS, finanzas, reporteria, facturacion electronica y
administracion de perifericos. El detalle esta en
[Inventario de modulos Web](web-module-inventory.md).

El layout tenant carga identidad, menu, permisos y contexto POS, y aplica
restricciones visuales por ruta (`web/app/[tenant]/layout.tsx#L135-L191` y
`#L970-L992`). Esto no sustituye los guards de la API.

## Estado y contexto

`web/app/providers.tsx#L1-L30` monta Redux y `AuthSessionManager`. Tambien
hidrata y persiste estado POS, carrito, alcance de inventario y asignaciones
locales de perifericos (`#L100-L273`). El contexto operativo puede contener
tenant, sucursal, terminal, sesion POS y sesion de caja. La sesion POS se
consulta en `/pos/session/current` y el contexto en `/auth/context`
(`web/domains/pos/api.ts#L1-L18`).

La persistencia local rehidrata la interfaz. No prueba operacion offline ni
garantiza transacciones offline.

## Autenticacion

`session-manager.ts` inicia sesion, decodifica claims JWT, carga `/auth/me`,
`/me/menu` y `/me/permissions`, y programa refresh con ventana de 60 segundos
(`web/domains/auth/session-manager.ts#L48-L180`). Usa `/auth/refresh`, deduplica
llamadas concurrentes y reintenta una request una vez. Un 401 definitivo limpia
sesion; un fallo de red o 5xx conserva la sesion rehidratada (`#L182-L298`).

El refresh token se conserva en memoria y, segun persistencia, en `localStorage`;
existe migracion desde `sessionStorage` (`web/domains/auth/session.ts#L1-L88`).
Esto es riesgo XSS y queda como hallazgo, no como cambio implementado.

## Consumo HTTP

`web/lib/http.ts#L16-L104` agrega `Authorization: Bearer`,
`x-pos-session-id` cuando aplica y `credentials: "include"`. Ante 401 intenta
refresh y repite una vez (`#L107-L183`). `web/next.config.mjs#L1-L14` declara
rewrite `/api/*` hacia `API_PROXY_TARGET`, por defecto `http://localhost:4020`.

Los reportes tienen cliente base separado. La configuracion declara
`NEXT_PUBLIC_REPORTS_API_BASE_URL` y el codigo consume rutas de reportes y
blobs directamente (`web/.env.example#L1-L32`,
`web/modules/reporteria/services/reporting.service.ts#L1-L237`). Esto no
demuestra que la API principal haga proxy de reporteria.

## Electron y perifericos

En Electron, el frontend puede usar `window.manusTerminal`; preload expone el
bridge y Electron main llama al cliente HTTP local del Agent
(`desktop/electron/preload.ts#L1-L22`, `desktop/electron/agent-client.ts#L1-L123`).
En Web convencional, el codigo usa las URLs configuradas del Agent HTTP/WS
cuando la funcionalidad esta habilitada. Contratos y seleccion de camino estan
en `web/domains/peripherals/contracts.ts` y `local-config-sync.ts#L65-L98`.

La documentacion de perifericos declara mocks y limites: no se certifican
USB, serial, HID, hardware fisico, offline ni auto-update
(`web/domains/peripherals/README.md`). Una falla de impresion o cajon se
registra como advertencia y no revierte la venta
(`web/domains/peripherals/pos-sale-integration.ts#L1-L233`).

## Estado de evidencia

Confirmado: estructura Next.js, rutas, Redux/providers, cliente HTTP, refresh,
cliente directo de reporteria y bridge Electron. Configurado: URLs de API,
reporteria y Agent, flags de perifericos y rewrite de Next.js. Pendiente:
validacion funcional por ambiente, offline, hardware real y despliegue
Electron.
