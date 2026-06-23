# Clientes Web/Electron para Manus POS

Fecha: 2026-06-20  
OpenSpec change: `definir-clientes-web-electron`  
Alcance: documental y arquitectonico. No implementa Electron, offline, PWA, Capacitor, frontend, backend, SQL, permisos ni logica de negocio.

## Decision ejecutiva

Manus POS debe clasificar clientes solo en tres tipos:

| Tipo | Modelo | Uso recomendado |
| --- | --- | --- |
| Tipo A | Web 100% | Administracion, consulta, reportes y operacion con conectividad estable desde navegador. |
| Tipo B | Electron 100% | Operacion desktop online, inicialmente caja/POS en terminal fisica. |
| Tipo D | Web + Electron | Modelo objetivo para negocio fisico: administracion web y caja/POS en Electron. |

No se define Tipo C ni otra categoria en esta fase.

## Discovery registrado

| Comando | Resultado |
| --- | --- |
| `git status --short` | Limpio al inicio, sin salida. |
| `git rev-parse --abbrev-ref HEAD` | `feat/0.0.1/arquitectura-clientes-web-electron` |
| `git rev-parse --short HEAD` | `689c054` |
| `openspec validate --all --strict` | El shim PowerShell `openspec.ps1` fallo por `ExecutionPolicy`. Se valido con `C:\nvm4w\nodejs\openspec.cmd validate --all --strict`: PASS, 31 passed, 0 failed. |

## Contexto revisado sin modificar

### Packages

| Archivo | Hallazgo |
| --- | --- |
| `package.json` raiz | No existe en la raiz del repo. |
| `web/package.json` | Next.js 14, React 18, Redux Toolkit, lucide-react. Sin `electron`, Capacitor, Workbox, PWA o service worker. |
| `api/package.json` | NestJS 10, `pg`, `jsonwebtoken`, `class-validator`, `tsx`, `pkg`. Sin `electron`, Capacitor, Workbox, PWA o sync offline client. |

### Frontend actual

Estructura revisada:

- `web/app`: App Router con rutas publicas y rutas tenant.
- `web/domains`: auth, branches, locations, menu, peripherals, pos, products, roles, system, tenants, users.
- `web/modules`: finance, inventory, pos, pricing, reporteria, terminals, electronic-invoicing.
- `web/store`: auth, menu, POS context, POS cart, tenant, branding, inventory scope.

Rutas publicas observadas:

- `/`
- `/login`
- `/forgot-password`
- `/unauthorized`

Rutas internas tenant observadas:

- `/{tenant}/dashboard`
- `/{tenant}/pos`
- `/{tenant}/pos/select-context`
- `/{tenant}/orders`
- `/{tenant}/purchases`
- `/{tenant}/customers`
- `/{tenant}/suppliers`
- `/{tenant}/inventory/*`
- `/{tenant}/finance/*`
- `/{tenant}/reporteria/*`
- `/{tenant}/terminales`
- `/{tenant}/config/terminals`
- `/{tenant}/admin/peripherals`
- `/{tenant}/configuracion`
- `/{tenant}/configuracion/menu`
- `/{tenant}/roles`
- `/{tenant}/usuarios`

### Modulos operativos revisados

| Area | Frontend | Backend/API |
| --- | --- | --- |
| POS | `web/app/[tenant]/pos`, `web/modules/pos`, `web/domains/pos`, `web/store/pos.ts`, `web/store/posCart.ts` | `api/src/modules/inventory/controllers/sale.controller.ts`, `api/src/modules/pos-user-sessions`, `api/src/modules/pos-terminals`, `api/src/modules/pricing`, `api/src/modules/finance` |
| Caja | `web/app/[tenant]/finance/*`, `web/modules/finance` | `api/src/modules/finance/cash-registers`, `cash-sessions`, `cash-movements`, `payments`, `payment-methods` |
| Pedidos | `web/app/[tenant]/orders`, `web/modules/inventory/components/Order*` | `api/src/modules/inventory/controllers/order.controller.ts`, `order.service.ts` |
| Clientes | `web/app/[tenant]/customers`, POS quick customer | `api/src/modules/inventory/controllers/customer.controller.ts`, `api/src/modules/electronic-invoicing/customers` |
| Proveedores | `web/app/[tenant]/suppliers`, `web/app/[tenant]/inventory/suppliers` | `api/src/modules/inventory/controllers/supplier.controller.ts`, `api/src/modules/electronic-invoicing/suppliers` |
| Compras | `web/app/[tenant]/purchases`, `web/app/[tenant]/inventory/purchases` | `api/src/modules/inventory/controllers/purchase.controller.ts`, `purchase.service.ts` |
| Inventario | `web/app/[tenant]/inventory/*`, `web/modules/inventory` | `api/src/modules/inventory/*`, `api/src/modules/pricing/*` |
| Reportes | `web/app/[tenant]/reporteria/*`, `web/modules/reporteria` | `backend-reporteria`, endpoints/reporting services |
| Autenticacion/sesion | `web/domains/auth`, `web/components/auth`, `web/store/authSlice.ts` | `api/src/modules/auth`, `api/src/common/guards/jwt-auth.guard.ts` |
| Permisos/roles | `web/domains/menu`, `web/domains/roles`, `web/lib/permissions.ts` | `api/src/modules/menu`, `api/src/modules/roles`, `api/src/modules/permissions`, `api/src/common/services/access-control.service.ts` |
| Terminales/sesiones POS | `web/app/[tenant]/pos/select-context`, `web/app/[tenant]/terminales`, `web/app/[tenant]/config/terminals` | `api/src/modules/terminals`, `api/src/modules/pos-terminals`, `api/src/modules/pos-user-sessions` |

### Soporte previo Electron/offline/PWA/local storage

Hallazgos:

- No se encontro dependencia Electron en `web/package.json` ni `api/package.json`.
- No se encontro dependencia Capacitor.
- No se encontro implementacion PWA ni service worker runtime en `web/`.
- No se encontro sync queue offline para POS.
- No se encontro IndexedDB como persistencia cliente.
- Si existe `localStorage` para contexto POS y carrito POS:
  - `web/store/pos.ts`: `POS_STORAGE_KEY = "pos-context"`.
  - `web/store/posCart.ts`: `POS_CART_STORAGE_PREFIX = "pos-cart:"`.
- Si existe `sessionStorage` para refresh token opt-in y cache de menu:
  - `web/domains/auth/session.ts`.
  - `web/domains/auth/menu-cache.ts`.
- La persistencia actual ayuda a recuperar contexto UI, pero no constituye offline ni sync engine.
- Hay documentacion previa que deja Electron como pendiente/post-v0.0.1, no implementado ni empaquetado.

## Tipo A: Web 100%

### Uso principal

Cliente usa Manus POS desde navegador moderno. No instala aplicacion local. Toda operacion depende de conectividad contra la API cloud.

### Modulos recomendados

- Administracion general.
- Usuarios, roles, permisos y menu.
- Tenants, sucursales, ubicaciones y terminales.
- Inventario.
- Compras.
- Clientes.
- Proveedores.
- Pedidos.
- Reporteria.
- Finanzas administrativas.
- POS solo si la terminal tiene conectividad estable y no depende de perifericos fisicos complejos.

### Modulos no recomendados

- Caja fisica intensiva con perifericos locales criticos.
- Operacion POS en sedes con conectividad inestable.
- Escenarios que requieran offline.
- Terminal dedicada para negocio con impresora, balanza, cajon o drivers locales sin validacion.

### Requisitos tecnicos

- Navegador moderno en Windows, Linux o macOS.
- Conectividad estable a Web cloud y API cloud.
- HTTPS.
- Politicas CORS y cookies/tokens consistentes con el despliegue.
- Usuarios y permisos configurados en backend.

### Ventajas

- Cero instalacion local.
- Actualizacion centralizada.
- Soporte simple para multiples sistemas operativos via navegador.
- Ideal para administracion remota y reportes.
- Menor complejidad de soporte tecnico.

### Limitaciones

- Sin offline.
- Acceso a hardware local limitado por navegador.
- Dependencia total de conectividad.
- La experiencia POS depende de estabilidad de red y navegador.

### Riesgos

- Caida de internet bloquea operacion.
- Perifericos locales pueden requerir agent o integracion separada.
- El cache de navegador puede ocultar cambios hasta refrescar sesion.
- Politicas de seguridad del navegador pueden bloquear integraciones locales.

### Perfil ideal

- Cliente administrativo.
- Empresa con operacion distribuida y conectividad estable.
- Negocio que prioriza consulta, reporteria, inventario y compras.
- Caja fisica baja o no critica.

## Tipo B: Electron 100%

### Uso principal

Cliente usa Manus POS en aplicacion desktop Electron online. La prioridad inicial es POS/caja en Windows. Electron actua como contenedor desktop de la experiencia web y consume API cloud.

Nota de implementacion inicial: el change `preparar-electron-online-windows` agrega la primera base tecnica en `desktop/electron/`, cargando la web existente mediante `MANUS_WEB_URL` o `http://localhost:3000`.

### Modulos recomendados

- POS/caja.
- Seleccion de contexto POS.
- Terminal/sucursal/tenant.
- Clientes de venta rapida.
- Productos para venta.
- Pagos.
- Tickets y perifericos cuando exista validacion por sistema operativo.
- Reportes operativos basicos para la terminal si se mantienen online.

### Modulos no recomendados

- Administracion completa como unico canal para usuarios de backoffice.
- Configuracion avanzada de roles/permisos como flujo principal.
- Reporteria gerencial amplia si el usuario no necesita desktop.
- Offline, hasta que exista fase formal futura.
- Facturacion electronica offline o fiscalidad local.

### Requisitos tecnicos

- Instalador Electron por sistema operativo.
- Configuracion inicial de tenant, sucursal y terminal.
- Conectividad con API cloud.
- Control de version del shell Electron y compatibilidad con version web/API.
- Validacion por OS de impresora, balanza, cajon, lector QR/codigo de barras y otros perifericos.
- Estrategia conceptual de actualizacion.

### Ventajas

- Experiencia desktop estable para caja.
- Mejor control de ventana, permisos y entorno de terminal.
- Base futura para integracion local y offline, sin implementarlo ahora.
- Mejor opcion inicial para clientes no tecnicos en POS fisico Windows.

### Limitaciones

- Requiere instalacion y soporte por equipo.
- Requiere empaquetado por sistema operativo.
- Sin offline en esta fase.
- Mayor complejidad de QA que Web 100%.
- Perifericos dependen de drivers y validacion real.

### Riesgos

- Versiones Electron desalineadas con Web/API.
- Antivirus, politicas corporativas o permisos locales pueden bloquear instalacion.
- Drivers de perifericos varian por fabricante y sistema operativo.
- Si Electron absorbe reglas de negocio, el producto se fragmenta.

### Perfil ideal

- Cliente con caja fisica dedicada.
- Punto de venta con terminales Windows.
- Operacion de mostrador que necesita entorno controlado.
- Cliente que acepta instalacion y soporte tecnico por terminal.

## Tipo D: Web + Electron

### Uso principal

Cliente usa Web para administracion y Electron para caja/POS. Es el modelo objetivo para negocios con operacion fisica en caja.

### Modulos recomendados

Web:

- Administracion.
- Usuarios, roles, permisos y menu.
- Inventario.
- Compras.
- Clientes y proveedores.
- Reporteria.
- Configuracion de tenant, sucursales y terminales.

Electron:

- POS/caja.
- Apertura/uso operativo de sesion POS.
- Venta y cobro.
- Impresion/ticket y perifericos cuando existan fases validadas.
- Configuracion local de tenant/sucursal/terminal.

### Modulos no recomendados

- Usar Electron como unico canal administrativo si el usuario puede operar mejor desde Web.
- Usar Web para caja fisica critica si Electron ya esta disponible y validado.
- Mezclar offline sin diseno formal posterior.
- Duplicar reglas de negocio entre Web, Electron y API.

### Requisitos tecnicos

- Web cloud desplegado y actualizado.
- Electron online instalado en terminales de caja.
- API cloud como punto de verdad operativo.
- Matriz de compatibilidad Web/Electron/API.
- Configuracion por tenant, sucursal y terminal.
- Versionado y soporte por sistema operativo.

### Ventajas

- Separa backoffice de caja fisica.
- Mantiene administracion independiente del sistema operativo.
- Permite terminales Electron segun OS del punto de venta.
- Reduce friccion para usuarios administrativos.
- Prepara camino a perifericos y offline futuro sin forzar esas capacidades ahora.

### Limitaciones

- Dos canales de despliegue a coordinar.
- Requiere soporte de instaladores Electron.
- Sin offline en esta fase.
- Necesita disciplina de compatibilidad por version.

### Riesgos

- Drift de version entre Web, Electron y API.
- Configuracion incorrecta de tenant/sucursal/terminal.
- Perifericos no certificados por OS.
- Soporte operativo mas complejo que Tipo A.

### Perfil ideal

- Restaurante, tienda o negocio con caja fisica.
- Equipo administrativo que trabaja desde navegador.
- Cajeros que necesitan terminal dedicada.
- Cliente con multiples sucursales o terminales.

## Clasificacion final recomendada

| Escenario de cliente | Tipo recomendado |
| --- | --- |
| Administracion, compras, inventario, reportes, baja caja fisica | Tipo A |
| Caja fisica dedicada sin backoffice web relevante | Tipo B |
| Operacion fisica con administracion separada | Tipo D |
| Cliente con conectividad inestable que pide offline | Fuera de alcance actual. Analizar en fase futura. |

La recomendacion de producto es tomar Tipo D como modelo objetivo para clientes con punto fisico. Tipo A queda como modelo simple y fuerte para administracion. Tipo B queda como variante desktop pura para caja o terminal dedicada.

## Decisiones fuera de alcance

- No instalar Electron.
- No instalar Capacitor.
- No disenar mobile.
- No implementar offline.
- No implementar PWA.
- No crear service worker.
- No crear sync engine.
- No crear almacenamiento local nuevo.
- No tocar backend.
- No tocar frontend.
- No tocar SQL.
- No modificar permisos.
- No modificar contratos API.
- No modificar rutas.
- No modificar logica de negocio.

## Fase de implementacion relacionada

- `preparar-electron-online-windows`: crea un shell Electron online minimo, Windows-first, sin offline, sin perifericos y sin instaladores.
