## Context

El installer actual es un ejecutable Go Windows (`backend-perifericos/windows-installer/main_windows.go`) que instala bundle, registra `ManusPeripheralAgent`, espera health y expone comandos de instalacion/status. No existe aun un host visual para el operador. `web/` contiene Next.js y componentes React, pero su runtime no debe ser embebido dentro del Agent ni introducir Electron en este cambio.

La fuente visual de verdad es `backend-perifericos/installer-ui/reference/manus-terminal-installer-approved.html`. La UI debe reproducir su composicion, densidad, navegacion, drawer tecnico y estados; los modelos mostrados son fixtures visuales.

Fase 2 usa `github.com/jchv/go-webview2` `v0.0.0-20260205173254-56598839c808`, compatible con Go 1.24 y Windows x64. WebView2 carga `assets/ui/index.html` desde `go:embed`; la referencia no se incluye como runtime.

## Goals / Non-Goals

**Goals:**

- Definir una UI visual Windows hospedada por el proceso installer.
- Separar Installer Core, Installer UI, PeripheralAgent y launcher Manus.
- Representar progreso, errores, dispositivos y estado final con datos de contratos existentes.
- Mantener la instalacion idempotente, segura y reversible.

**Non-Goals:**

- Cambiar discovery, RAW, perfiles, cajon o runtime del Agent.
- Implementar Electron, shell replacement, autologin, kiosk lockdown o updater.
- Resolver aun startup avanzado de Manus POS.

## Decisions

### Host visual

Investigar primero WebView2/WebView embebido disponible en Windows. La recomendacion es un host nativo ligero que sirva assets estaticos locales y exponga un bridge minimo al Installer Core. No se agrega Electron. Si WebView2 no esta disponible, conservar una ruta de fallback textual y reportarlo como riesgo de implementacion.

### Responsabilidades

- **Installer Core:** filesystem, servicio Windows, health gate, rollback y operaciones privilegiadas.
- **Installer UI:** renderiza pantallas y estados; nunca ejecuta PowerShell ni escribe JSON directamente.
- **PeripheralAgent:** health, discovery, device update y operaciones fisicas existentes.
- **Manus Terminal Launcher:** solo se documenta como integracion futura.

### Datos y seguridad

El bridge entrega DTOs de progreso y respuestas sanitizadas. Secretos, tokens y rutas internas no aparecen en la vista normal. Detalles tecnicos pueden mostrar version, modo, cuenta, identidad y errores resumidos.

### Contratos

Reutilizar `GET /health`, `POST /devices/discover`, `PATCH /devices/:id`, `POST /printer/test-print` y `POST /cash-drawer/open`. No crear endpoints nuevos en este change.

### Estados y responsive

Usar modelo explicito `PENDING | RUNNING | SUCCESS | WARNING | ERROR | SKIPPED`. Shell oscuro con paleta aprobada y contenido con scroll interno para 1024x768 hasta 1920x1080.

La barra `Mock navegable` solo existe en DEV/MOCK y se excluye del build productivo.

### Runtime chrome y navegacion mock

`backend-perifericos/installer-ui/reference/manus-terminal-installer-approved.html`
continua siendo la fuente visual de verdad para navegador/mock. El host WebView2
usa los mismos assets y estados, pero genera un HTML runtime con `.window-bar`
oculta para conservar exclusivamente la barra nativa de Windows. El artefacto
UI Spike conserva `.prototype-nav` visible para QA; el runtime productivo la
oculta. Ambos se generan desde una unica fuente, sin duplicar HTML.

El host bloquea contenido remoto. Fase 3 expone únicamente un bridge tipado de
lectura (`getInstallerState`, `discoverDevices`); las operaciones de escritura
(`configureDevice`, `testPrinter`, `testCashDrawer`, instalación y servicio) no
se registran en WebView2.

### Fase 3: bridge read-only

`installerReadOnlyBridge` consulta `http://127.0.0.1:4050/health` y
`POST /devices/discover` desde Go y devuelve DTOs JSON sanitizados. El cliente
WebView2 no puede ejecutar shell, PowerShell, filesystem, registry ni endpoints
mutantes. Errores del Agent se convierten en respuestas controladas; no hay
fallback silencioso a fixtures en esta capa.

El modo `--ui-spike` usa fixtures (`MOCK`). El modo `--ui-bridge-qa` usa
`REAL_READONLY`: al cargar llama una vez a `getInstallerState()` y luego una vez
a `discoverDevices()`. La lista se reconstruye con los dispositivos devueltos;
si el Agent no responde o devuelve cero, se muestra error/vacío operativo y no
se reintroducen impresoras fixture.

### Fase 4: configuración de perfil

`--ui-config-qa` habilita únicamente `configureDevice`. El bridge valida que el
ID pertenezca a la última sesión de discovery y limita perfiles a
`THERMAL_58MM` y `THERMAL_80MM`; Go fija el destino al loopback del Agent y
envía solo `terminalId` y `profileId` por `PATCH /devices/:id`. No se expone
metadata arbitraria ni se registran acciones de impresión o cajón.

`--ui-print-qa` agrega únicamente `testPrinter` sobre impresoras descubiertas y
con perfil soportado. El payload es `{terminalId, deviceId}` hacia
`POST /printer/test-print`; Go fija loopback, valida el dispositivo y no ejecuta
discovery adicional. `testCashDrawer` continúa sin binding.

`--ui-drawer-qa` agrega `testCashDrawer` como única operación adicional. Go
valida impresora descubierta, conexión, perfil y certificación persistida antes
de enviar `{terminalId, printerDeviceId, deviceId, reason}` a
`POST /cash-drawer/open`. Connector, pin y tiempos de pulso no son editables
desde la UI. La confirmación de apertura es local a QA y no cambia la
certificación del Agent.

## Risks / Trade-offs

- [WebView2 no instalado] -> detectar capacidad antes de instalar y mantener fallback documentado.
- [Bridge con privilegios excesivos] -> API minima tipada; UI nunca recibe handles ni comandos arbitrarios.
- [Installer bloqueado durante operaciones] -> eventos de progreso y cancelacion confirmada.
- [Reuso de componentes Next aumenta bundle] -> extraer solo primitives compatibles, sin copiar rutas de aplicacion.
- [Kiosk se mezcla con instalacion] -> dejar startup/kiosk en follow-up separado.

## Migration Plan

1. Implementar modelo de estados y contrato del bridge sin cambiar instalacion existente.
2. Crear shell visual y conectar operaciones existentes en modo QA.
3. Probar fallback y rollback del Installer Core.
4. Ejecutar QA Windows limpio; si falla UI, conservar camino tecnico actual.

## Fase 7 — integración productiva

El Installer Core Go sigue siendo la única autoridad para instalación versionada,
servicio, health gate y rollback. La UI WebView2 solo representa un estado tipado
y solicita acciones permitidas por el Core; no duplica operaciones privilegiadas.

El modelo `installerCoreState` define fase, progreso, pasos, paso actual,
advertencia, error y cancelabilidad. Los pasos productivos definidos son
requisitos, archivos, instalación del Agent, servicio, health, discovery,
periféricos y finalización. El estado inicial deja todos los pasos en `PENDING`,
por lo que la UI no puede afirmar éxitos que no ocurrieron.

El reducer tipado acepta eventos `STEP_STARTED`, `STEP_SUCCEEDED`,
`STEP_WARNING`, `STEP_FAILED`, `ROLLBACK_*` e `INSTALL_*`, con secuencia
monotónica, transiciones válidas y progreso derivado de pasos terminados. La
publicación de esos eventos reales desde cada operación del Core queda pendiente.
Discovery,
configuración, impresión y cajón solo se habilitan después de health exitoso y
usan los bridges ya certificados. Cero dispositivos es un resultado operativo no
fatal; scanner y balanza son opcionales.

Mientras esa integración no esté conectada, el flujo sin flags conserva el Core
técnico existente y no se ejecuta un instalador productivo visual. No se reclama
“Terminal lista” hasta que autostart/launcher y readiness real estén implementados.

### Fase 7.1B — Core real

`install()` conserva su entrada pública y delega en `installWithObserver`.
Los wrappers mapean `ensureSupportedHost`/`ensureElevated` a
`VERIFY_REQUIREMENTS`; `ensureBaseDirectories` a `PREPARE_FILES`;
`copyBundleToVersion`, `copySelfExecutable`, `ensureLocalConfig`, permisos,
`stopService` y `ensureCurrentJunction` a `INSTALL_AGENT`;
`configureService` a `CONFIGURE_SERVICE`; `startService` a `START_SERVICE`;
`waitForHealth` a `VERIFY_SERVICE`; y `writeUninstallMetadata` a
`FINALIZE_INSTALLATION`. `rollbackToPreviousVersion` queda intacta y se rodea
con eventos `ROLLBACK_STARTED`, `ROLLBACK_SUCCEEDED` o `ROLLBACK_FAILED`.

### Same-version repair transaccional

El repair de una version ya activa nunca escribe sobre el target live. Copia
el bundle a un staging unico, valida `VERSION.json` y los archivos requeridos,
detiene y confirma el servicio detenido, mueve el target anterior a un backup
independiente y activa el replacement. El rollback restaura ese backup y
reconstruye `current`, servicio y health. La identidad y ProgramData quedan
fuera del payload reemplazable.

Preflight clasifica como `INCONSISTENT` una instalacion con footprints
productivos pero sin metadata `VERSION.json` valida.

## Open Questions

### Harness visual Fase 7.1

`--ui-core-flow-qa[=success|rollback-success|rollback-fail]` usa eventos
deterministas en memoria y el mismo reducer. Cada snapshot se envía a
`window.manusInstaller.onState` mediante `WebView2.Dispatch`; el goroutine del
harness no llama directamente al hilo UI. El modo no invoca instalación,
servicios, health real, rollback real, filesystem ni PeripheralAgent.

- Confirmar disponibilidad minima de WebView2 en las maquinas objetivo.
- Elegir mecanismo exacto de bridge Go/UI despues de spike, sin comprometer Electron.
- Definir change futuro para launcher, Startup app o Edge kiosk.
