# Electron online Windows implementation

Fecha: 2026-06-20  
OpenSpec change: `preparar-electron-online-windows`

## Objetivo

Preparar la base tecnica minima para ejecutar Manus POS dentro de Electron en modo desktop online, priorizando Windows y cargando la web existente.

## Alcance

- Crear shell Electron en `desktop/electron/`.
- Mantener Next.js en `web/` como frontend principal.
- Cargar la URL web configurada por `MANUS_WEB_URL`.
- Usar `http://localhost:3000` por defecto para desarrollo local.
- Ejecutar online contra la API usada por la web.
- Agregar scripts de desarrollo, build TypeScript y typecheck.
- Documentar decisiones, seguridad base y limitaciones.

## Fuera de alcance

- Offline.
- Sincronizacion.
- IndexedDB.
- Service worker.
- PWA.
- Capacitor.
- Backend.
- SQL.
- Permisos.
- Logica de negocio.
- Facturacion.
- Caja.
- POS.
- Pedidos.
- Clientes.
- Perifericos.
- Instaladores.
- Firma.
- Auto-update.
- Impresion nativa.
- Bascula, lector, gaveta o impresora fiscal.

## Estructura creada

```text
desktop/
  electron/
    main.ts
    preload.ts
    README.md
    package.json
    tsconfig.json
```

Despues de instalar dependencias tambien se genera:

```text
desktop/electron/package-lock.json
desktop/electron/node_modules/
```

`node_modules/` no debe versionarse.

## Como correr en desarrollo

Requisito local para este paquete Electron: Node.js `>=22.12.0`.

Levantar primero la web:

```powershell
cd web
npm run dev
```

Luego ejecutar Electron:

```powershell
cd desktop/electron
npm install
npm run dev
```

Si la web corre en otra URL:

```powershell
$env:MANUS_WEB_URL="http://localhost:3000"
npm run dev
```

## Variables de entorno

| Variable | Default | Descripcion |
| --- | --- | --- |
| `MANUS_WEB_URL` | `http://localhost:3000` | URL base de la web Manus POS. |
| `MANUS_ELECTRON_WINDOW_TITLE` | `Manus POS` | Titulo inicial de ventana. |
| `MANUS_ELECTRON_WINDOW_WIDTH` | `1280` | Ancho inicial de ventana. |
| `MANUS_ELECTRON_WINDOW_HEIGHT` | `800` | Alto inicial de ventana. |
| `MANUS_ELECTRON_CLOSE_BEHAVIOR` | `quit` | `quit` cierra app, `hide` oculta ventana. |
| `MANUS_ELECTRON_OPEN_DEVTOOLS` | `false` | Abre DevTools si se define como `true`. |

No se introduce configuracion multitenant local en Electron. Tenant, sucursal, terminal, permisos y sesion siguen viniendo de la web/API.

## Seguridad base Electron

`BrowserWindow` se crea con:

- `contextIsolation: true`.
- `nodeIntegration: false`.
- `sandbox: true`.
- `preload` separado.

El preload inicial no expone APIs de negocio. No hay APIs para POS, caja, inventario, clientes, permisos, backend ni perifericos.

Navegacion:

- La app permite navegar dentro del mismo origen de `MANUS_WEB_URL`.
- Intentos de abrir nueva ventana se interceptan.
- URLs externas con protocolo seguro (`http`, `https`, `mailto`, `tel`) se abren con `shell.openExternal`.
- `webview` se bloquea.

## Decisiones tecnicas

### Paquete aislado

Electron vive en `desktop/electron/`. No se modifica `web/package.json`.

### Online-only

Electron no contiene base local, cola de sync ni motor offline. Si no hay acceso a la URL configurada, la app no puede operar Manus POS.

### Web existente como UI

Electron no define rutas propias. La web Next.js mantiene login, rutas tenant, POS, caja, pedidos, clientes, reportes y permisos.

### Windows primero

El primer objetivo de desarrollo es Windows. Linux y macOS quedan como compatibilidad futura. No se generan instaladores en esta fase.

## Limitaciones conocidas

- Requiere que `MANUS_WEB_URL` este disponible.
- No valida hardware real.
- No imprime nativo.
- No integra perifericos.
- No tiene auto-update.
- No tiene instalador productivo firmado.
- No define configuracion tenant/sucursal/terminal local.
- No resuelve firma ni SmartScreen.

Nota posterior: el empaquetado Windows local se prepara en `preparar-empaquetado-electron-windows` con `electron-builder`, target `dir` y opcion `portable`, sin firma ni auto-update.

## Proximas fases

1. QA local Electron online con web y API levantadas.
2. Configuracion tenant/sucursal/terminal para shell.
3. Validacion POS/caja online en Windows.
4. Validacion perifericos Windows.
5. Empaquetado Windows local.
6. Firma e instalador productivo.
7. Soporte Linux.
8. Soporte macOS.
9. Investigacion offline futura.

## Relacion con clientes Tipo B y Tipo D

Tipo B usa Electron como canal principal desktop online. Esta fase crea la base minima para ese flujo, sin offline.

Tipo D usa Web para administracion y Electron para caja/POS. Esta fase habilita el primer paso tecnico para la parte Electron, manteniendo administracion en navegador.
