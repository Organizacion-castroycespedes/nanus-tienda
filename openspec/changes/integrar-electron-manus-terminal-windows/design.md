## Context

La fase 7.1 dejó `ManusTerminalSetup.exe` con instalación versionada, servicio, health gate, repair transaccional, rollback y desinstalación certificada. El cliente Electron existente vive en `desktop/electron/`: `main.ts` crea un `BrowserWindow`, `preload.ts` no expone APIs, `config.ts` resuelve `MANUS_WEB_URL` (por defecto `http://localhost:3000`) y `package.json` usa Electron `^42.4.1` y electron-builder `^26.15.3`.

El shell actual carga una URL web y aplica `contextIsolation`, `sandbox`, `nodeIntegration: false`, bloqueo de webviews y navegación por origen. El empaquetado Windows existente produce un directorio `release/win-unpacked` o un portable, pero todavía no forma parte del installer productivo. El baseline de Agent 0.1.1-qa.4 y el change 7.1 son inmutables durante esta planificación.

## Goals / Non-Goals

**Goals:**

- Definir un paquete Electron autocontenido para Windows sin Node/npm instalados.
- Integrar Agent y POS bajo una instalación única, preservando staging, activación, rollback y uninstall de 7.1.
- Separar configuración DEV (`localhost`) de producción (frontend HTTPS explícito y validado).
- Definir shortcuts, primer lanzamiento, reparación, desinstalación estándar y `--remove-data`.
- Mantener una frontera segura para la futura comunicación con `http://127.0.0.1:4050`.

**Non-Goals:**

- No implementar código, rebuild, package ni cambios en Installer Core en este change.
- No implementar discovery, configuración o pruebas de impresoras, scanner, balanza o cajón.
- No implementar kiosk, autologin, updater, offline, auto-update, Linux, macOS ni firma.

## Decisions

### Shell Electron online con frontend cloud HTTPS

Producción cargará una URL HTTPS configurable y validada. `http://localhost:3000` queda permitido solo para desarrollo explícito. No se distribuirá un servidor Next.js ni se dependerá de `npm run dev`; así se evita un proceso local no gestionado y se conserva un frontend desplegado centralmente. La URL debe tener origen permitido y fallback de error visible si no responde.

### Paquete Electron independiente y autocontenido

Se usará electron-builder con runtime Electron, `resources/app.asar`, DLLs, locales y recursos incluidos. El usuario no necesitará Node/npm. La versión del POS tendrá metadatos propios y se validará antes de activar el directorio. El tamaño exacto se medirá en 7.2B/C; se espera un orden de cientos de MB por incluir Chromium.

### Layout versionado separado

El POS se instalará en `C:\Program Files\Manus\POS\versions\\<version>`, con `current` apuntando al payload validado. Agent conserva su layout certificado en `PeripheralAgent`. Staging y backups serán externos a los targets activos; Installer Core seguirá siendo dueño de la transacción y del rollback.

### Un único orquestador Installer Core

La integración añadirá el payload POS al plan real del Core mediante un seam explícito. JavaScript solo representa progreso y solicita acciones. No habrá un segundo instalador, cambio de `current`, registro de servicio ni rollback paralelo.

### Comunicación futura Agent/Electron mediante frontera explícita

El frontend cloud no recibirá una URL arbitraria desde usuario. La futura integración deberá usar una allowlist de loopback y, preferentemente, un preload IPC mínimo o endpoint configurado por el shell. Antes de discovery se resolverán CORS, CSP y la política HTTPS→HTTP; no se habilitará mixed content de forma implícita.

### Shortcuts administrados por Installer Core

El Core creará y eliminará acceso directo de Desktop y Start Menu apuntando a `Manus POS.exe`, con working directory y argumentos controlados. Repair actualizará el destino de forma atómica; uninstall eliminará solo accesos creados por Manus.

### Primer lanzamiento explícito

Tras instalación exitosa, la UI ofrecerá `Abrir Manus POS`. No se abrirá Electron automáticamente sin una decisión de producto posterior. Si ya existe una instancia, se enfocará la existente o se mostrará un error operativo; no se crearán múltiples instancias accidentalmente.

## Risks / Trade-offs

- **Frontend cloud no disponible** → mostrar página de error operativa con reintento; no depender de localhost ni afirmar POS listo.
- **HTTPS hacia loopback HTTP** → navegador puede bloquear mixed content y CORS; resolver mediante contrato seguro/IPC y CSP antes de implementar periféricos.
- **Paquete Chromium grande** → medir tamaño y almacenamiento durante packaging; no mezclarlo con el artifact certificado 7.1.
- **Rollback de dos payloads** → activar Agent y POS solo después de staging/validación conjunta; conservar candidatos independientes.
- **Repair de POS** → preservar sesión/configuración fuera de `resources/app.asar`; documentar qué datos son removibles en `--remove-data`.
- **Navegación externa o nuevas ventanas** → mantener allowlist y bloquear por defecto; investigar APIs disponibles antes de declarar hardening completo.
- **Firma y SmartScreen** → fuera de alcance de esta planificación; artifact QA no se considera release.

## Migration Plan

1. Completar discovery y registrar contratos sin tocar código 7.1.
2. Construir y validar Electron de forma independiente en una máquina limpia.
3. Integrar el payload mediante staging/rollback del Core en un change de implementación posterior.
4. Probar fresh install, repair, reboot, standard uninstall y `--remove-data` sin periféricos.
5. Solo tras aprobación manual, ejecutar E2E físico y considerar release.

Rollback de la integración: desactivar el paquete POS y restaurar el artifact 7.1; no modificar Agent certificado ni sus rutas activas.

## Open Questions

- ¿Cuál será la URL HTTPS de producción y su allowlist de origins?
- ¿Se requiere autenticación persistente o login interactivo en primer lanzamiento?
- ¿Qué datos de sesión/configuración Electron deben preservarse en standard uninstall?
- ¿El contrato final Agent/Electron será IPC preload o fetch loopback con CORS/CSP dedicado?
- ¿Qué versión independiente de POS se aprobará para el primer paquete integrado?

## Discovery 7.2A validado

- DEV frontend: `http://localhost:3000`, probado por `config.spec.ts` y README.
- QA/online frontend: `https://www.apptiendamanus.space`, evidenciado por `desktop/electron/config.spec.ts`, documentación QA y allowlist del Agent.
- Producción: UNKNOWN; no hay un dominio productivo distinto probado en este repositorio.
- API pública documentada: `https://api.apptiendamanus.space`; no reemplaza al Agent loopback.
- Agent: bind por defecto `127.0.0.1`, puerto `4050`, health `/health`; CORS permite origins configurados y PNA tiene middleware explícito.
- Preload actual: vacío; handlers IPC actuales: ninguno.
- Seguridad actual: aislamiento, sandbox, sin Node en renderer, navegación por origin y webviews bloqueados. Descargas y permisos aún requieren decisión productiva.

## Contrato de canal propuesto

El recurso versionado `resources/manus-shell.config.json` será la fuente de verdad. Su esquema cerrado tendrá `environment`, `frontendUrl`, `allowedOrigins` y `agentLoopbackOrigin`. QA usa el dominio HTTPS evidenciado; producción queda bloqueada hasta aprobación de URL. El renderer nunca podrá cambiar esos valores.

## Packaging y payload

`npm run pack:win` ejecuta `electron-builder --win dir` y produce `release/win-unpacked`; `npm run dist:win` ejecuta `--win portable` y produce portable. Se recomienda `win-unpacked` para que Installer Core sea dueño del ciclo de vida. El payload debe incluir `Manus POS.exe`, `resources/app.asar`, `resources/manus-shell.config.json`, DLLs, locales, snapshots, iconos y licencias. No se ejecutó build en esta fase; tamaño exacto pendiente.

## Política de navegación y primer lanzamiento

Solo origins Manus aprobados pueden navegar dentro de la ventana. Externos se bloquean o pasan por `shell.openExternal` según allowlist. Webviews y permisos quedan denegados por defecto; DevTools solo QA. `Abrir Manus POS` se ejecutará en la sesión interactiva del usuario, no directamente desde el contexto elevado del installer; debe usarse un mecanismo de lanzamiento con token/sesión validado.
## Resultado 7.2B

Se implementaron `electron-api.ts`, `agent-client.ts`, preload IPC y validación estricta de `resources/manus-shell.config.json`. `getAgentHealth` usa únicamente `GET /health`, destino loopback fijo, timeout de 2500 ms y límite de 64 KiB. El paquete `win-unpacked` fue generado y medido: 75 archivos, 371174289 bytes, `Manus POS.exe` 232313344 bytes, `resources/app.asar` 15975 bytes y config presente. El arranque local del ejecutable fue comprobado; la carga visual HTTPS queda pendiente de QA dedicado.

### Lifecycle de ventana 7.2B

La ventana terminal será frameless, no minimizable, no redimensionable y ajustada al `workArea` del display primario mediante `screen`. Cambios de métricas, DPI y displays dispararán un reajuste. Alt+F4 y solicitudes normales de cierre se bloquean; renderer no recibe una API de quit/close. `app.requestSingleInstanceLock()` enfoca la primera ventana ante un segundo proceso. Un futuro estado de maintenance, fuera del renderer, permitirá repair/uninstall controlados.

El renderer tendrá recuperación acotada ante `render-process-gone`: máximo tres recargas en 60 segundos; después se muestra error terminal. `unresponsive` solo registra diagnóstico. Watchdog y autostart interactivo quedan diseñados, no implementados; kiosk/Assigned Access no forman parte del alcance.
## Lifecycle 7.2B implementado

La ventana POS queda frameless, fullscreen y no minimizable; el payload `win-unpacked` se instala de forma versionada bajo `Program Files\\Manus\\POS` con `current`, manifiesto de hashes y CTA host `Abrir Manus POS`. La integración de shortcuts, rollback coordinado y QA físico completo permanece pendiente.

Avance integrado: el payload Electron `win-unpacked` se incorpora como recurso versionado separado del Agent. El Core copia y valida el payload en `Program Files\\Manus\\POS\\versions\\<posVersion>` y crea `current`; el manifiesto contiene hashes completos. La UI ofrece `Abrir Manus POS` mediante binding fijo del host. Shortcuts, rollback coordinado y QA fÃ­sico integrado siguen pendientes.

La ventana POS usa `frame: false`, `fullscreen: false`, `minimizable: false` y `resizable: false`. Sus bounds salen de `screen.getPrimaryDisplay().workArea`; se reajustan ante cambios de mÃ©tricas y displays. `app.requestSingleInstanceLock()` evita ventanas independientes y enfoca/restaura la primera. El cierre normal, incluido Alt+F4, queda bloqueado fuera de un estado interno de maintenance no expuesto al renderer. La recuperaciÃ³n de renderer permite tres recargas en 60 segundos y luego muestra error terminal.
## Peripheral transport vertical slice (7.2B)

Electron renderer calls the explicit `window.manusTerminal` bridge for health,
device listing/discovery, configuration, printer test, cash-drawer open,
scanner simulation, scale read and logs. The main process owns all loopback
HTTP requests and uses only fixed Agent routes (`/health`, `/devices`,
`/devices/discover`, `/devices/:id`, `/printer/test-print`,
`/cash-drawer/open`, `/scanner/simulate`, `/scale/current-weight`, `/logs`).
The renderer never supplies a URL, method or host. Web transport remains the
existing configured HTTP path. Physical device mapping and configuration
persistence remain pending Windows QA with the SP-58/XP-80 fixture.
