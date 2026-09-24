# Matriz de contratos IPC y HTTP locales — B4.3

## IPC Electron

| Método `window.manusTerminal` | Canal IPC | Destino HTTP | Payload/resultado |
|---|---|---|---|
| `getRuntimeInfo` | `manusTerminal.getRuntimeInfo` | health interno | versión, Agent y capabilities |
| `getShellInfo` | `manusTerminal.getShellInfo` | ninguno | ambiente, shell y origen |
| `getAgentHealth` | `manusTerminal.getAgentHealth` | `GET /health` | disponibilidad y razón |
| `listDevices` | `manusTerminal.listDevices` | `GET /devices` | lista de dispositivos |
| `discoverDevices` | `manusTerminal.discoverDevices` | `POST /devices/discover` | terminal y lista |
| `createDevice` / `updateDevice` | canales equivalentes | `POST/PATCH /devices` | payload de device |
| `testPrint` | `manusTerminal.testPrint` | `POST /printer/test-print` | job, preview y capabilities |
| `printTicket` | `manusTerminal.printTicket` | `POST /printer/print-ticket` | ticket y resultado |
| `openCashDrawer` | `manusTerminal.openCashDrawer` | `POST /cash-drawer/open` | comando/pulso y resultado |
| `simulateScanner` | `manusTerminal.simulateScanner` | `POST /scanner/simulate` | code, format y timestamp |
| `currentWeight` | `manusTerminal.currentWeight` | `GET /scale/current-weight` | weight, unit y stable |
| `listLogs` | `manusTerminal.listLogs` | `GET /logs` | logs limitados |

## Contratos Web/Agent

`web/domains/peripherals/contracts.ts` decide destino y flags. En navegador puede
usar URLs configuradas; en Electron puede usar `window.manusTerminal`. El código
del POS no envía ESC/POS directo. `pos-sale-integration.ts` envía contenido de
ticket después de venta confirmada.

## Seguridad y contexto

Electron limita el bridge al preload. El Agent valida tipos, ids, formatos,
hosts, puertos y tamaños. CORS usa `PERIPHERALS_ALLOWED_ORIGINS`. No se observó
token de autenticación en `agent-client.ts` ni guard por tenant en los controllers
locales. `terminalId`, `deviceId` y metadata se usan para asociación, no equivalen
a autorización comercial backend.

## Estados de respuesta

Los adapters devuelven `mode` `MOCK` o `REAL`, `adapterName`, `profile`,
`capabilities`, comandos, preview y opcionalmente `bytesSent`. Los errores son
HTTP controlados, timeout, `AGENT_UNAVAILABLE`, dispositivo no encontrado,
adaptador real deshabilitado o fallo de transporte.
