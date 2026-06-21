# Manus POS Electron online

Electron shell inicial para ejecutar Manus POS como aplicacion desktop online.

## Objetivo

Abrir la web existente de Manus POS dentro de Electron. Este paquete no contiene frontend propio, rutas POS ni reglas de negocio.

## Alcance

- Carga `MANUS_WEB_URL`.
- Usa `http://localhost:3000` por defecto en desarrollo.
- Mantiene Electron online-only.
- Prioriza Windows para la primera validacion.
- Aplica baseline basico de seguridad Electron.

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
- Perifericos.
- Instaladores.
- Firma.
- Auto-update.
- Impresion nativa.

## Instalacion

Requiere Node.js `>=22.12.0` para la version Electron instalada en esta fase.

Desde esta carpeta:

```powershell
npm install
```

## Desarrollo local

1. Levantar la web Next.js desde `web/`:

```powershell
cd ..\..\web
npm run dev
```

2. En otra terminal, ejecutar Electron desde `desktop/electron/`:

```powershell
cd ..\desktop\electron
npm run dev
```

Por defecto Electron carga:

```text
http://localhost:3000
```

## Variables de entorno

| Variable | Default | Uso |
| --- | --- | --- |
| `MANUS_WEB_URL` | `http://localhost:3000` | URL web que Electron debe cargar. |
| `MANUS_ELECTRON_WINDOW_TITLE` | `Manus POS` | Titulo inicial de ventana. |
| `MANUS_ELECTRON_WINDOW_WIDTH` | `1280` | Ancho inicial. |
| `MANUS_ELECTRON_WINDOW_HEIGHT` | `800` | Alto inicial. |
| `MANUS_ELECTRON_CLOSE_BEHAVIOR` | `quit` | `quit` o `hide`. |
| `MANUS_ELECTRON_OPEN_DEVTOOLS` | `false` | Abre DevTools si vale `true`. |

Ejemplo:

```powershell
$env:MANUS_WEB_URL="http://localhost:3000"
npm run dev
```

## Scripts

```powershell
npm run dev
npm run build
npm run typecheck
```

## Seguridad base

- `contextIsolation: true`.
- `nodeIntegration: false`.
- `sandbox: true`.
- `preload.ts` separado.
- El preload no expone APIs de negocio.
- Navegacion fuera del origen configurado se bloquea o se abre con `shell.openExternal`.
- `webview` queda bloqueado.

## Limitaciones

- Requiere que la web este disponible.
- Requiere Node.js moderno para desarrollo local de Electron.
- No opera offline.
- No empaqueta instaladores.
- No integra perifericos.
- No firma binarios.
- No implementa auto-update.
