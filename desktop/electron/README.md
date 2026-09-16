# Manus POS Electron online

Electron shell inicial para ejecutar Manus POS como aplicacion desktop online.

## Objetivo

Abrir la web existente de Manus POS dentro de Electron. Este paquete no contiene frontend propio, rutas POS ni reglas de negocio.

## Alcance

- Carga `MANUS_WEB_URL`.
- Usa `https://www.apptiendamanus.space/login` como fallback cuando no se configura una URL.
- Puede resolver ruta inicial con `MANUS_START_PATH`.
- Puede leer contexto local reservado de tenant, sucursal y terminal.
- Mantiene Electron online/static: el shell carga la URL web configurada y conserva su recuperacion del renderer.
- Empaqueta el mismo shell para Windows, Linux y macOS.
- Mantiene el agente de perifericos como proceso separado. No se incluye en los paquetes Electron.
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
- Instaladores productivos firmados.
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
npm run dist:linux
npm run dist:mac
```

## Empaquetado por sistema operativo

Los comandos generan artefactos sin firma para validacion. No publican releases ni hacen deploy.

| Sistema | Comando | Artefactos | Runner requerido |
| --- | --- | --- | --- |
| Windows | `npm run pack:win` | directorio `win-unpacked` | Windows recomendado |
| Windows | `npm run dist:win` | ejecutable portable `.exe` | Windows |
| Linux | `npm run dist:linux` | `.AppImage` y `.deb` | Linux |
| macOS | `npm run dist:mac` | `.dmg` y `.zip` | macOS |

MSI es un formato de instalacion exclusivo de Windows. Este proyecto no configura MSI. Linux usa AppImage/DEB y macOS usa DMG/ZIP.

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

Los artefactos de `release/`, `dist/` y `out/` no se versionan. El workflow `build-desktop.yml` conserva temporalmente los paquetes unsigned como artefactos de CI y no los despliega.

## URL web y agente local

El shell no contiene una copia del frontend. En desarrollo toma `MANUS_WEB_URL`, `NEXT_PUBLIC_MANUS_WEB_URL` y `MANUS_START_PATH`. En un paquete usa `resources/manus-shell.config.json`, salvo overrides permitidos por el runtime existente. La ruta `/login`, el allowlist HTTPS y el fallback/recovery no cambian por sistema operativo.

El acceso al agente usa `http://127.0.0.1:4050`. El agente y sus instaladores viven en `backend-perifericos/` y tienen limites propios por OS. Los comandos `dist:*` de Electron no compilan ni incorporan ese backend.

## Android

No hay proyecto Android, Capacitor, React Native ni wrapper movil en el repositorio. Electron y `electron-builder` no generan APK/AAB. Por eso Android queda bloqueado y no se publica un paquete falso.

El siguiente paso, si se aprueba Android como producto, es elegir un wrapper movil, definir navegacion segura hacia la web, ciclo de sesion, permisos y estrategia para perifericos; despues se agrega un proyecto Android y su toolchain/keystore por separado.

## Firma y distribucion

- Windows: el `.exe` de CI no esta firmado. La firma requiere certificado de code signing y configuracion segura en CI.
- macOS: DMG/ZIP de CI quedan sin firma ni notarizacion. Una entrega publica requiere identidad Developer ID, credenciales Apple y notarizacion en runner macOS.
- Linux: AppImage/DEB no incorporan firma de repositorio. La distribucion por repositorio APT requiere un flujo de firma separado.

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
