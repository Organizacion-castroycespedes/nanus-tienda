# Evidencia QA — Xprinter XP-80T USB + NETWORK

## Rama y objetivo

- Rama: `feat/develop/Xprinter-XP-80T-USB-+-LAN`
- HEAD inicial: `5d07c00`
- Objetivo: primer periférico físico oficial Manus: `PRINTER`, perfil `THERMAL_80MM`, conexiones `NETWORK` y `USB`.
- Sin migraciones SQL, commit, push, despliegue ni cambios en ventas, inventario, pagos, scanner, balanza o cajón.

## Hardware

- Xprinter XP-80T: térmica directa, papel 79.5 ± 0.5 mm, ancho 72 mm, aproximadamente 200 mm/s y corte parcial.
- Variantes USB/Ethernet y emulación ESC/POS.
- Fuente: [ficha oficial Xprinter XP-80T](https://www.xprinter.net/product/733.html).

## Arquitectura encontrada

| Función | Estado inicial | Estado final MVP |
| --- | --- | --- |
| Modelo `type` / `connectionType` | IMPLEMENTADO_PARCIAL | IMPLEMENTADO_REAL |
| Perfil `THERMAL_80MM` | IMPLEMENTADO_REAL | IMPLEMENTADO_REAL |
| NETWORK TCP/IP RAW ESC/POS | IMPLEMENTADO_PARCIAL, flag real apagado | IMPLEMENTADO_REAL, preservado |
| USB impresión | NO_IMPLEMENTADO | IMPLEMENTADO_REAL vía cola/driver SO |
| Búsqueda de dispositivos | SIMULADO | IMPLEMENTADO_PARCIAL: MOCK + colas USB SO |
| Registro | SIMULADO, memoria | IMPLEMENTADO_PARCIAL, memoria con asociación USB descubierta |
| Prueba de impresión | SIMULADO; NETWORK real existente | IMPLEMENTADO_REAL para NETWORK y USB con flag |
| Estado `CONNECTED` | IMPLEMENTADO_PARCIAL | IMPLEMENTADO_PARCIAL; no health hardware continuo |
| Eventos WebSocket | IMPLEMENTADO_REAL | IMPLEMENTADO_REAL; fallos de print conservados |
| Persistencia dispositivo | NO_IMPLEMENTADO | NO_IMPLEMENTADO, intencional |

Frontend: `web/app/[tenant]/admin/peripherals/page.tsx` carga `web/domains/peripherals/components/PeripheralsPage.tsx`. Usa `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL` y `NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL`; producción exige HTTPS/WSS.

Agent: `backend-perifericos`, NestJS local, HTTP loopback y WebSocket `/peripherals`. Rutas preservadas: `GET /health`, `GET /devices`, `POST /devices/discover`, `POST /devices`, `POST /printer/test-print`, `POST /printer/print-ticket`.

OpenSpec previo: `add-pos-peripherals-platform` sigue abierto. Este change conserva rutas NETWORK y no modifica sus tareas.

## Arquitectura final

```text
Web admin / POS document
  -> HTTP Peripheral Agent
     -> adapter por connectionType
        NETWORK -> Node TCP RAW -> ESC/POS printer
        USB     -> cola/driver del SO -> USB printer
```

`type = PRINTER` no cambia. NETWORK exige `network.host`, `network.port`, `network.timeoutMs`. USB exige `usb.deviceId` descubierto por el agent y asocia nombre de cola; no solicita host/port. No hay IP, puerto, vendor ID, product ID ni device ID hardcodeados. Puerto RAW, incluso 9100, es configurable.

Windows descubre USB/DOT4USB con `Get-Printer`. Linux/macOS descubre CUPS USB con `lpstat -v`. Windows imprime por `System.Drawing.Printing.PrintDocument`; Linux/macOS con `lp -d <queue> -o raw`. Driver compatible es requisito del host, no dependencia Manus.

## Prueba de impresión

```text
MANUS POS
PRUEBA DE IMPRESION
Modelo: <nombre registrado>
Perfil: THERMAL_80MM
Conexion: USB | NETWORK
Terminal: <terminalId>
IMPRESION OK
```

NETWORK convierte documento a ESC/POS RAW. USB entrega documento a cola SO. Browser no construye ESC/POS.

## Archivos principales

- `backend-perifericos/src/shared/usb/usb-printer-discovery.ts`
- `backend-perifericos/src/shared/adapters/usb-system-printer.adapter.ts`
- `backend-perifericos/src/modules/devices/devices.service.ts`
- `backend-perifericos/src/modules/printer/printer.service.ts`
- `web/domains/peripherals/printer-registration.ts`
- `web/domains/peripherals/components/PeripheralsPage.tsx`
- `openspec/changes/soportar-xprinter-xp80t-usb-network/`

## Validaciones técnicas

| Comando | Resultado |
| --- | --- |
| `cd backend-perifericos && npm.cmd test` | PASS — 42 tests |
| `cd backend-perifericos && npm.cmd run build` | PASS |
| `cd web && C:\nvm4w\nodejs\npx.cmd tsx --test domains/peripherals/printer-registration.spec.ts` | PASS — 3 tests |
| `cd web && npm.cmd run lint` | PASS con warnings preexistentes |
| `cd web && npm.cmd run build` | PASS técnico; compilación y type-check con warnings preexistentes |
| `openspec validate soportar-xprinter-xp80t-usb-network --strict` | PASS |
| `openspec validate --all --strict` | PASS — 66 items |
| `git diff --check` | PASS; solo avisos CRLF de Git |

Warnings: dependencias de hooks y `<img>` en páginas existentes ajenas a periféricos; `caniuse-lite` desactualizado. Esta iteración no agrega warnings en periféricos. `npx tsc --noEmit` también falla por fixture preexistente `web/modules/deliveries/delivery-helpers.spec.ts` sin cinco campos de `DeliveryRecord`; no pertenece a periféricos. Next build sí compiló y validó tipos de la app.

## QA hardware real

**PASS técnico:** sí, con fakes TCP, discovery USB y cola SO.

### Intento de QA físico — 2026-08-19

- Host del Peripheral Agent: Windows; interfaz Wi-Fi `192.168.1.14`.
- `Get-Printer` solo reportó `Microsoft Print to PDF`; no había cola, driver ni
  puerto USB/DOT4USB de una Xprinter XP-80T.
- El agent no estaba escuchando en el puerto local `4050` al iniciar el intento.
- ARP local mostró `192.168.1.5` y gateway `192.168.1.254`, pero ninguno
  aporta identidad verificable de XP-80T ni puerto RAW. No se asumió IP ni 9100.
- No hubo impresión, corte, desconexión/reconexión, eventos WebSocket ni logs
  de hardware para verificar. No se asigna PASS ni FAIL físico.

### Bug de arranque encontrado y corregido

- Causa: el build de producción de Nest intentaba resolver el parámetro de
  interfaz `UsbPrinterDiscovery` de `DevicesService` como proveedor `Object`.
  El agent terminaba antes de exponer `/health`.
- Fix mínimo: se marcó esa dependencia de pruebas como `@Optional()` y se
  conserva `SystemUsbPrinterDiscovery` como default real.
- Evidencia posterior al fix: `npm.cmd test` PASS (42/42),
  `npm.cmd run build` PASS, agent escuchando en `127.0.0.1:4050`,
  `GET /health` PASS y `POST /devices/discover` PASS.
- Discovery posterior: `usbPrinterCount: 0`; el log fue
  `devices.discover.simulated`. Sin cola USB instalada no hubo dispositivo
  físico ni evento de impresión para probar.

**Estado de ejecución:** bloqueado por ausencia de impresora conectada/cola USB
y de IP NETWORK confirmada. Requiere conectar el equipo y confirmar la prueba
impresa físicamente.

**PASS hardware NETWORK:** PENDIENTE. Probar IP real, host/puerto/timeout, test print, corte, desconexión LAN y reconexión.

**PASS hardware USB:** PENDIENTE. Instalar driver si aplica, iniciar agent, discovery, seleccionar XP-80T, registrar, test print, desconectar/reconectar y verificar error/reintento.

## Pendientes y límites

- Registro/discovery vive en memoria. Reiniciar requiere descubrir/registrar otra vez. Persistencia requiere diseño y aprobación SQL separados.
- No hay escaneo LAN automático ni identificación garantizada de marca/modelo por driver.
- USB CUPS y Windows requieren QA física por SO/driver.
- `CONNECTED` refleja discovery/registro, no monitoreo permanente.
