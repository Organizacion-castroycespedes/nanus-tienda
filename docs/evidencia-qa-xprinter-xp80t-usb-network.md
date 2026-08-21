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

## QA Reporteria POS / THERMAL_80MM

### Hardware y flujo confirmado

- Impresora usada: `XP-80` / Xprinter XP-80T compatible.
- Conexion: USB en Windows, mediante cola/driver `XP-80` y puerto USB real.
- Flujo probado: `Manus -> PDF backend-reporteria -> iframe PDF Chrome -> Windows spooler/driver -> XP-80`.
- El Peripheral Agent no participa en este flujo. Su prueba USB independiente
  `POST /printer/test-print` ya genero papel fisico correctamente.

### Resultado previo de hardware

- Vista previa PDF: PASS.
- Seleccion manual de `XP-80` en Chrome/Windows: PASS.
- Ticket fisico de venta POS: PASS funcional.
- Layout fisico `THERMAL_80MM`: PARTIAL. Se observo clipping en el borde
  derecho: importes como `$ 40.000` quedaron parcialmente cortados y las
  columnas `Item` / `Valor` llegaron demasiado cerca del borde.
- No se declara PASS del layout corregido sin una nueva impresion fisica.

### Causa raiz y correccion tecnica

- El PDF usaba ancho nominal de 80 mm (`226 pt`) y margenes horizontales de
  `12 pt` (4.2 mm). Su contenido de 71.3 mm casi agotaba el ancho imprimible
  comun de 72 mm de una termica 80 mm; no habia tolerancia real para driver,
  spooler ni borde fisico.
- Las columnas de item y pagos usaban valores `auto`, sin reservar presupuesto
  estable para importes.
- `thermal-layout.ts` ahora declara `THERMAL_80MM_LAYOUT`: papel de 80 mm,
  referencia imprimible de 72 mm, contenido seguro de 68 mm y margenes de
  6 mm por lado.
- Items, pagos y totales reservan una columna de importe alineada a la derecha.
  UUIDs, SKU/tokens y nombres sin espacios reciben puntos de corte invisibles;
  no se borran datos ni se cambian calculos.

### QA tecnico posterior

| Comando | Resultado |
| --- | --- |
| `cd backend-reporteria && npx tsx --test src/modules/pdf/templates/base/thermal-layout.spec.ts` | PASS - 4 tests |
| `cd backend-reporteria && npm run build` | PASS |

### QA fisico posterior requerido

1. Abrir `/00000000-0000-0000-0000-000000000001/reporteria/pos`.
2. Abrir la misma venta, pulsar `Imprimir` y seleccionar `XP-80`.
3. Usar papel 80 mm y escala estandar/100 %, sin workaround manual.
4. Verificar encabezado, items, cantidades, precios, pagos, caja, subtotal,
   impuestos, total, pagado, cambio, saldo y footer.
5. Confirmar que no hay clipping izquierdo/derecho ni caracteres fuera del
   papel. Confirmar corte solo si el dialogo/driver lo ejecuta; Browser PDF no
   manda un comando ESC/POS de corte.

**Estado actual:** PASS tecnico. QA fisico THERMAL_80MM posterior pendiente.

### Discovery posterior: POS -> Peripheral Agent (sin implementacion)

- El cierre de venta vive en `web/modules/pos/components/PosScreen.tsx`.
  `submitSale()` llama `createSale()` y, despues de confirmar, construye
  `PosSalePeripheralContext` y ejecuta `handleSalePeripheralFeedback()`.
- No existe un boton POS visible `Imprimir ticket`. La llamada actual es un
  efecto asincrono post-venta, gobernado por feature flags de perifericos.
- `runSalePeripheralOperations()` ya forma un payload para
  `POST /printer/print-ticket` mediante `buildSaleTicketPayload()`. Ese
  payload reutiliza items, totales y pagos ya confirmados; no reutiliza el PDF
  de Reporteria como bytes.
- La resolucion web prevista usa `resolvePeripheralTerminalConfig()` para
  obtener `terminalId` y `printerDeviceId`. Si falla, cae a
  `local-terminal` / `mock-printer-001`. El Agent, por su parte, busca por
  `deviceId` exacto; actualmente no resuelve ni valida la asociacion por
  `terminalId` durante `findRequired()`.
- Para USB real sin dialogo Chrome falta una asociacion duradera y confiable
  terminal -> deviceId disponible para el Agent despues de reinicio, UX de
  operacion real en vez de mensajes `MOCK`, y contrato de resultado/errores
  operacional. El registro del Agent sigue en memoria.
- El adapter USB actual entrega texto a `System.Drawing.Printing.PrintDocument`.
  Aunque el documento conceptual incluye `CUT`, este camino no envia bytes
  ESC/POS RAW; por tanto el corte USB directo requiere un futuro adapter/raw
  spooler o soporte confirmado del driver. No se implemento en este change.

## Impresion directa Reporteria POS

### Cambio tecnico - 2026-08-20

- La tabla de `/reporteria/pos` ahora separa `Ver ticket` e `Imprimir`.
- `Ver ticket` abre solamente el PDF. El modal conserva `Cerrar` y
  `Descargar`; no tiene accion `Imprimir`.
- `Imprimir` solicita el dataset canonico autorizado con
  `GET /reports/pos-sales/:saleId/ticket-data` y manda un trabajo a
  `POST /printer/print-ticket` mediante el Peripheral Agent. No abre PDF,
  dialogo Chrome ni selector de impresora.
- La politica de reimpresion usa la terminal POS actual del operador. Una
  venta historica no obliga a usar una terminal historica posiblemente remota
  o apagada.
- Se exige una configuracion persistida real de terminal con
  `printerDeviceId`; una terminal real sin impresora retorna
  `PRINTER_NOT_CONFIGURED`. No cae silenciosamente a `mock-printer-001`.
- El contenido directo reutiliza items, totales y pagos canonicos. No toma
  HTML, imagenes ni recalcula la venta.
- Cuando los adapters reales estan habilitados, el Agent ejecuta discovery USB
  al startup. El `deviceId` sigue siendo el identificador estable derivado de
  la cola Windows, por ejemplo `XP-80`.
- El adapter USB de Windows envia el documento a
  `System.Drawing.Printing.PrintDocument`. Declara
  `supportsPhysicalCut = false`; `USB RAW ESC/POS + physical CUT` sigue
  pendiente.

### QA tecnico

| Comando | Resultado |
| --- | --- |
| `cd backend-perifericos && npm.cmd test` | PASS - 42 tests |
| `cd backend-perifericos && npm.cmd run build` | PASS |
| `cd backend-reporteria && npx.cmd tsx --test src/modules/reports/sales-reports.service.spec.ts` | PASS - 7 tests |
| `cd backend-reporteria && npm.cmd run build:bin` | PASS |
| `cd web && npx.cmd tsx --test modules/reporteria/direct-print.spec.ts domains/peripherals/contracts.spec.ts` | PASS - 2 tests |
| `cd web && npm.cmd run lint` | PASS con warnings preexistentes |
| `cd web && npm.cmd run build` | PASS con warnings preexistentes |

### QA hardware requerida

- Impresora: `XP-80`, USB Windows, cola/driver `XP-80`.
- Discovery USB fisico ya confirmado: terminal `local-terminal`, deviceId
  `usb-printer-1f0028d1fa5243c2`, perfil `THERMAL_80MM` y conexion `USB`.
  La configuracion persistida usada para esta QA debe apuntar a ese deviceId
  mientras el nombre de la cola no cambie.
- Abrir una venta en `/reporteria/pos` y probar `Ver ticket`: preview,
  `Cerrar`, `Descargar`, sin boton `Imprimir` dentro del modal.
- Cerrar el modal y pulsar la accion de tabla `Imprimir`: no debe abrir Chrome
  ni preview; el Agent debe enviar el trabajo al `deviceId` configurado de la
  terminal actual.
- Validar papel fisico, layout `THERMAL_80MM`, error al desconectar USB y
  recuperacion al reconectar.
- El resultado correcto de software es `Ticket enviado a la impresora`: no
  confirma que el papel salio. No declarar PASS hardware hasta validar el
  papel.

**Estado:** PASS tecnico. QA hardware impresion directa XP-80 USB pendiente.
**USB physical CUT:** PENDING.

### Regresion QA manual: Agent no invocado - 2026-08-20

- Resultado manual: FAIL antes de hardware. Al pulsar `Imprimir`, DevTools solo
  mostro `OPTIONS` y `GET ticket-data`; no hubo `POST /printer/print-ticket`.
- Causa raiz: `PosReportsPage` pasaba `posContext.terminalId` nulo cuando
  Reporteria se abria sin contexto POS hidratado. `requireRealPrinterConfig()`
  rechazaba ese valor antes de llamar a `resolve-current` o al Agent.
- Fix: se elimina ese early return. Ahora la accion resuelve primero
  `GET /pos-terminals/resolve-current` con tenant/sucursal. El API selecciona
  la terminal activa por defecto de la sucursal; solo si devuelve una terminal
  `CONFIGURED`, `REAL` o `HYBRID`, activa y con deviceId no mock se manda
  `POST http://127.0.0.1:4050/printer/print-ticket`.
- En desarrollo, si no existe `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL`, el
  default web ahora es `http://127.0.0.1:4050` (y WebSocket
  `ws://127.0.0.1:4050/peripherals`), no `localhost`.
- Device previsto para XP-80: `usb-printer-1f0028d1fa5243c2`. Si falta
  configuracion real retorna `PRINTER_NOT_CONFIGURED`; Agent caido retorna
  `AGENT_OFFLINE`; device ausente retorna `DEVICE_NOT_FOUND`.
- Pruebas nuevas: terminal de sucursal -> Agent POST, fallback mock bloqueado,
  Agent offline y device not found. PASS tecnico, 4 escenarios.

**QA hardware impresion directa:** sigue PENDIENTE. Repetir primero DevTools:
debe verse `GET /pos-terminals/resolve-current` y despues
`POST http://127.0.0.1:4050/printer/print-ticket`. Solo despues validar papel.
