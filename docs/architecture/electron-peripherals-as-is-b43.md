# Electron y Peripheral Agent AS-IS — B4.3

## Estado de la arquitectura

Electron es un shell online. Carga la Web remota configurada. No contiene las
rutas POS ni la lógica comercial. El Agent es proceso separado; no viene dentro
del paquete Electron.

| Frontera | Evidencia | Clasificación |
|---|---|---|
| Web dentro de Electron | `desktop/electron/main.ts`, `README.md` | Implementado |
| Preload controlado | `desktop/electron/preload.ts` | Implementado |
| API `window.manusTerminal` | `desktop/electron/electron-api.ts` | Implementado |
| IPC registrado | `desktop/electron/main.ts:100-138` | Implementado |
| HTTP local Electron-Agent | `desktop/electron/agent-client.ts` | Implementado |
| Agent en loopback | `http://127.0.0.1:4050` en config validada | Configurado |
| Hardware físico | Adaptadores reales y colas del sistema | No verificado |
| Offline, auto-update y firma | README Electron los excluye | No implementado/documentado |

## Shell Electron

La ventana usa `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
y preload separado. La navegación solo conserva el origen configurado; URLs
externas se abren con protocolos seguros permitidos. Descargas y permisos de
ventana están bloqueados en `main.ts`.

El shell monitorea disponibilidad de la Web, muestra una página local de
conectividad y reintenta navegación. Esto no prueba disponibilidad del API ni del
Agent y no habilita operación offline.

El archivo de configuración empaquetado exige ambiente QA o producción, URL Web
HTTPS, origen permitido y Agent exactamente en loopback `127.0.0.1:4050`.
La URL heredada de EMAUS aparece como fallback/configuración; su vigencia no se
certifica aquí.

## Preload e IPC

`preload.ts` expone solamente métodos tipados mediante `contextBridge`:

`getRuntimeInfo`, `getShellInfo`, `getAgentHealth`, `retryConnection`,
`listDevices`, `discoverDevices`, `createDevice`, `updateDevice`, `testPrint`,
`printTicket`, `openCashDrawer`, `simulateScanner`, `currentWeight` y `listLogs`.

El renderer no recibe `ipcRenderer` directo ni Node. Los handlers IPC rechazan o
devuelven valores degradados si no existe configuración empaquetada. El código
valida tipos simples en varios handlers, pero la validación detallada de payloads
ocurre en el Agent. No se encontró autenticación Bearer propia entre Electron y
el Agent; el límite principal declarado es proceso, loopback, origen y preload.

## Peripheral Agent

El Agent NestJS monta módulos de health, devices, printer, cash drawer, scale,
scanner, logs y events. Por defecto usa `PERIPHERALS_MODE=MOCK` y mantiene
`PERIPHERALS_ENABLE_REAL_ADAPTERS=false`.

Configuración relevante por nombre:

- `PERIPHERALS_PORT`, `PERIPHERALS_BIND`;
- `PERIPHERALS_MODE`, `PERIPHERALS_ENABLE_REAL_ADAPTERS`;
- `PERIPHERALS_ALLOWED_ORIGINS`;
- `PERIPHERALS_USB_PRINT_TRANSPORT`;
- `PERIPHERALS_PRINTER_WIDTH_CHARS` y nivel/límite de logs.

El Agent usa CORS con orígenes allowlist y middleware de Private Network Access.
Las peticiones locales no muestran autenticación de aplicación. No se debe tratar
este diseño como equivalente a autenticación de usuario o autorización POS.

## Fronteras de dispositivos

- **Impresora MOCK:** genera preview y comandos conceptuales.
- **Impresora NETWORK:** genera bytes ESC/POS y usa socket TCP cuando el flag real
  está activo.
- **Impresora USB:** usa cola del sistema; RAW/GDI según configuración y sistema.
- **Cajón:** se abre mediante pulso enviado por impresora compatible.
- **Scanner:** el Agent expone simulación; el scanner real principal documentado
  para POS es wedge HID en Web.
- **Balanza:** endpoint existente entrega lectura simulada estable de `1.25 kg`.

Serial, HID nativo, WebUSB, Electron directo para scanner y compatibilidad física
universal no están demostrados como implementaciones operativas.

## Tickets y frontera fiscal

La venta Web confirmada construye `SaleTicketInput`, luego solicita ticket al
Agent. El ticket puede llevar líneas, pagos, impuestos, CUFE, QR y estado fiscal
como campos de contenido. Eso no prueba que sea factura electrónica aceptada.

La persistencia comercial, el evento fiscal y la impresión son etapas separadas:
venta primero, outbox/facturación según B4.1-B2.3, periférico después. Error de
impresión no hace rollback de PostgreSQL.

## Seguridad, errores y límites

El Agent valida tipo de objeto, identificadores, texto, formato, host, puerto,
timeouts y tamaño de respuesta. Bloquea hosts loopback para dispositivos NETWORK
y limita acceso USB real a configuración explícita. Registra errores sanitizados,
estado del dispositivo y eventos.

No hay evidencia suficiente de autenticación del Agent, autorización por tenant
para cada dispositivo, idempotencia de comandos, reimpresión automática, firma de
instaladores, auto-update, offline o certificación física.

## Documentos relacionados

[Inventario de dispositivos](peripheral-device-inventory-b43.md),
[contratos](peripheral-contract-matrix-b43.md),
[fallos](peripheral-failure-recovery-b43.md),
[QA](peripheral-qa-evidence-b43.md), [B4.2 Web POS](pos-frontend-as-is.md).
