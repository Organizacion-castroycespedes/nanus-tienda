# Manus POS Electron online

Electron shell inicial para ejecutar Manus POS como aplicacion desktop online.

## Objetivo

Abrir la web existente de Manus POS dentro de Electron. Este paquete no contiene frontend propio, rutas POS ni reglas de negocio.

## Alcance

- Carga `MANUS_WEB_URL`.
- Usa `https://www.apptiendamanus.space/login` como fallback cuando no se configura una URL.
- Puede resolver ruta inicial con `MANUS_START_PATH`.
- Puede leer contexto local reservado de tenant, sucursal y terminal.
- Mantiene Electron online-only.
- Prioriza Windows para la primera validacion.
- Puede generar un empaquetado Windows local de validacion.
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
- Instaladores productivos.
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

Para desarrollo local, configurar de forma explicita:

```text
MANUS_WEB_URL=http://localhost:3000
```

## Variables de entorno

| Variable | Default | Uso |
| --- | --- | --- |
| `MANUS_WEB_URL` | `NEXT_PUBLIC_MANUS_WEB_URL` o `https://www.apptiendamanus.space/login` | URL de la web que Electron debe cargar. Tiene prioridad sobre `NEXT_PUBLIC_MANUS_WEB_URL`. |
| `NEXT_PUBLIC_MANUS_WEB_URL` | ninguno | URL pública alternativa, útil cuando se comparte la configuración de Next.js. Se usa si no existe `MANUS_WEB_URL`. |
| `MANUS_START_PATH` | ninguno | Ruta inicial. Debe empezar con un solo `/`. Tiene prioridad sobre `MANUS_TENANT_ID`. |
| `MANUS_TENANT_ID` | ninguno | Tenant inicial opcional. Si no hay `MANUS_START_PATH`, construye `/<tenantId>`. |
| `MANUS_BRANCH_ID` | ninguno | Sucursal local reservada. No altera la URL en esta fase. |
| `MANUS_TERMINAL_ID` | ninguno | Terminal local reservada. No altera la URL en esta fase. |
| `MANUS_ELECTRON_WINDOW_TITLE` | `Manus POS` | Titulo inicial de ventana. |
| `MANUS_ELECTRON_WINDOW_WIDTH` | `1280` | Ancho inicial. |
| `MANUS_ELECTRON_WINDOW_HEIGHT` | `800` | Alto inicial. |
| `MANUS_ELECTRON_CLOSE_BEHAVIOR` | `quit` | `quit` o `hide`. |
| `MANUS_ELECTRON_OPEN_DEVTOOLS` | `false` | Abre DevTools si vale `true`. |

### Abrir `/login` en PowerShell

```powershell
$env:MANUS_WEB_URL="http://localhost:3000"
$env:MANUS_START_PATH="/login"
npm run dev
```

### Abrir ruta tenant en PowerShell

```powershell
$env:MANUS_WEB_URL="http://localhost:3000"
$env:MANUS_TENANT_ID="00000000-0000-0000-0000-000000000001"
Remove-Item Env:MANUS_START_PATH -ErrorAction SilentlyContinue
npm run dev
```

### Abrir `/login` en Bash

```bash
MANUS_WEB_URL=http://localhost:3000 MANUS_START_PATH=/login npm run dev
```

### Configurar contexto reservado en Bash

```bash
MANUS_WEB_URL=http://localhost:3000 \
MANUS_TENANT_ID=00000000-0000-0000-0000-000000000001 \
MANUS_BRANCH_ID=branch-demo \
MANUS_TERMINAL_ID=terminal-demo \
npm run dev
```

## Que no hace esta configuracion

- No autentica al usuario.
- No cambia permisos.
- No crea sesion POS.
- No abre caja.
- No envia `branchId` o `terminalId` por un canal nuevo al backend.
- No crea almacenamiento local operativo.
- No habilita offline.

## Scripts

```powershell
npm run dev
npm run build
npm test
npm run typecheck
npm run pack:win
npm run dist:win
```

## Empaquetado Windows local

Esta fase usa `electron-builder` solo para validacion local Windows. No hay firma, certificados, auto-update ni publicacion automatica de releases.

Generar build desempaquetado:

```powershell
npm run pack:win
```

Generar portable, si el entorno lo permite:

```powershell
npm run dist:win
```

Salida esperada:

```text
desktop/electron/release/
```

Probar build desempaquetado:

```powershell
$env:MANUS_WEB_URL="http://localhost:3000"
$env:MANUS_START_PATH="/login"
.\release\win-unpacked\Manus POS.exe
```

Los artefactos de `release/`, `dist/` y `out/` no se versionan.

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
- No crea instalador productivo firmado.
- No integra perifericos.
- No firma binarios.
- No implementa auto-update.

## Diagnostico de soporte

La pantalla de conexion interrumpida solo indica que la carga inicial de la web fallo y reintenta la misma URL cada tres segundos. No demuestra que el API o el agente local esten disponibles y no habilita operacion offline.

El agente ya expone una consulta de salud por el canal IPC `manusTerminal.getAgentHealth`. Antes de agregar datos tecnicos a la pantalla de fallback se debe definir una vista de soporte separada que:

- consulte el API con un endpoint de salud estable, sin credenciales ni datos del negocio;
- consulte la salud del agente mediante el canal existente;
- muestre estados independientes para web, API y agente;
- no cambie el reintento actual ni prometa continuidad de ventas sin API;
- no exponga URLs internas, tokens, trazas ni configuracion sensible.

Esta mejora queda pendiente porque incorporarla ahora cambiaria la experiencia productiva y requiere confirmar el contrato del endpoint de salud del API.

## Mantenimiento de dependencias

La instalacion reproducible actual informa paquetes deprecados transitivos (`inflight`, `rimraf@2`, `glob@7` y `boolean`) y un aviso de configuracion `http-proxy` de npm. No se modificaron dependencias ni lockfiles en esta correccion.

El mantenimiento debe hacerse en un PR separado: identificar que dependencia directa introduce cada paquete, actualizar una familia a la vez, regenerar el lockfile con la version de Node/npm definida por el proyecto y repetir `npm run build`, `npm test` y el empaquetado de Windows. Los avisos de Browserslist pertenecen al frontend web y deben tratarse en su paquete, no desde Electron.
