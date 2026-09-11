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

## USB RAW ESC/POS / THERMAL_80MM

### Estado previo confirmado

- Reporteria POS -> Peripheral Agent -> XP-80 USB: **PASS fisico**.
- Terminal: `HYBRID`.
- Device: `usb-printer-1f0028d1fa5243c2`.
- `POST /printer/print-ticket`: `201`.
- El camino directo no usa Browser, PDF ni dialogo Chrome.
- Hallazgos fisicos previos: clipping derecho y ausencia de corte automatico.

### Causa raiz

El adapter USB entregaba texto a `System.Drawing.Printing.PrintDocument` con
`Consolas` 8 y coordenadas GDI. Ese camino no controlaba el ancho termico RAW
ni enviaba bytes ESC/POS, aunque la respuesta mostrara comandos conceptuales.
Por eso no habia garantia de margen derecho ni comando fisico `CUT`.

### Cambio tecnico - 2026-08-21

- Se agrego renderer ESC/POS compartido. NETWORK RAW y USB RAW consumen el
  mismo preview termico y los mismos bytes.
- `THERMAL_80MM` conserva 48 columnas monoespacio como limite seguro, alineado
  con 80 mm nominales, aproximadamente 72 mm imprimibles y 68 mm seguros.
  Items/tokens largos envuelven; importes no exceden la linea.
- En Windows, `UsbRawPrinterAdapter` usa la cola descubierta y el spooler RAW:
  `OpenPrinter`, `StartDocPrinter`, `StartPagePrinter`, `WritePrinter`,
  `EndPagePrinter`, `EndDocPrinter`, `ClosePrinter`.
- Definir `PERIPHERALS_USB_PRINT_TRANSPORT=RAW` para este camino. No existe
  fallback automatico si RAW falla.
- `PERIPHERALS_USB_RAW_PHYSICAL_CUT_CERTIFIED=false` es el valor inicial. RAW
  manda `CUT` para esta QA, pero `supportsPhysicalCut` no pasa a `true` hasta
  observar corte fisico y habilitar esa certificacion.
- `PERIPHERALS_USB_PRINT_TRANSPORT=GDI` conserva el fallback legado solo de
  forma explicita. En GDI, `supportsPhysicalCut=false`.
- En RAW `THERMAL_80MM`, el payload termina con feed y `GS V 0`. El Agent
  informa soporte de corte fisico por adapter, no certificacion de papel.

### QA tecnico

| Comando | Resultado |
| --- | --- |
| `cd backend-perifericos && npm.cmd test` | PASS - 46 tests |
| `cd backend-perifericos && npm.cmd run build` | PASS |

### QA hardware RAW/CUT requerida

1. Definir `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`,
   `PERIPHERALS_USB_PRINT_TRANSPORT=RAW` y
   `PERIPHERALS_USB_RAW_PHYSICAL_CUT_CERTIFIED=false`; reiniciar el Agent actualizado.
2. Confirmar que `GET /health` responde desde el proceso actualizado y que
   discovery muestra la cola `XP-80` con
   `usb-printer-1f0028d1fa5243c2`.
3. Desde `/reporteria/pos`, usar `Imprimir`. No debe abrir PDF ni Chrome.
4. Validar todos los bordes, importes, items, footer, avance y corte fisico.
   Solo tras corte observado, habilitar
   `PERIPHERALS_USB_RAW_PHYSICAL_CUT_CERTIFIED=true`, reiniciar y confirmar
   `supportsPhysicalCut=true` en la respuesta siguiente.
5. Desconectar USB: el Agent debe producir error controlado, sin exito falso.
6. Reconectar, redescubrir si aplica y reintentar.

**Estado:** PASS tecnico + QA hardware RAW/CUT pendiente.
**USB physical CUT:** PENDING hasta observacion fisica real.

### QA hardware RAW inicial - 2026-08-21

- Impresion directa: PASS.
- `UsbRawPrinterAdapter`: PASS.
- ESC/POS RAW fisico: PASS.
- `THERMAL_80MM`, clipping derecho, importes e informacion completa: PASS.
- Corte fisico: la cuchilla funciona, pero **FAIL de posicionamiento**. El
  footer `Gracias por su compra` quedo despues del corte, en una segunda pieza.

### Correccion de secuencia final

- Causa: el renderer cerraba con solo dos saltos de linea (`LF LF`) antes de
  `GS V 0`. En la XP-80 ese avance no dio margen suficiente para el buffer
  fisico de papel.
- Fix: el final RAW ahora es exactamente
  `BODY -> FOOTER -> ESC d 6 -> GS V 0`.
- `ESC d 6` ordena avance de seis lineas debajo del footer antes del corte.
- No se tocaron 48 columnas, layout, frontend, ventas, pagos, impuestos,
  inventario, terminales ni configuracion de perifericos.
- `PERIPHERALS_USB_RAW_PHYSICAL_CUT_CERTIFIED` permanece `false` hasta repetir
  y observar esta QA final.

### QA hardware final requerida

1. Reiniciar el Agent actualizado con RAW y
   `PERIPHERALS_USB_RAW_PHYSICAL_CUT_CERTIFIED=false`.
2. Imprimir desde `/reporteria/pos` hacia XP-80 USB.
3. Confirmar que `Gracias por su compra` queda en el ticket principal.
4. Confirmar avance bajo el footer y corte debajo de todo el contenido.
5. Solo si pasa, habilitar la certificacion de corte, reiniciar y confirmar
   `supportsPhysicalCut=true`.

**Estado posterior al fix:** PASS tecnico + QA hardware final CUT position
pendiente.

### QA hardware final - XP-80 USB RAW

- Impresion directa desde Reporteria POS: PASS.
- `UsbRawPrinterAdapter`: PASS.
- ESC/POS RAW USB: PASS.
- `THERMAL_80MM`, clipping derecho, importes e informacion completa: PASS.
- Footer `Gracias por su compra` dentro del ticket principal: PASS.
- Feed final debajo de todo el contenido: PASS.
- Corte fisico automatico debajo del ticket: PASS.

**QA HARDWARE XP-80 USB RAW = PASS**

**PHYSICAL CUT = PASS**

Confirmacion runtime final ejecutada con
`PERIPHERALS_USB_RAW_PHYSICAL_CUT_CERTIFIED=true`:

- `supportsPhysicalCut=true`: PASS.
- Ticket completo: PASS.
- Sin clipping: PASS.
- Footer completo: PASS.
- Corte automatico: PASS.

**Estado final: PASS tecnico + PASS hardware XP-80 USB RAW + PASS physical CUT.**

## Alineación terminal operativa / periféricos QA - 2026-08-21

- La identidad operativa canónica es `terminals.id`; `pos_terminals` es el
  perfil periférico opcional enlazado de forma explícita.
- V071 fue aplicada exclusivamente a `manus_tienda_qa` mediante el runner
  incremental seleccionado, con `manus_qa_user` como identidad DDL y
  `manus_user` preservado como usuario runtime de API.
- Mapping QA aplicado:
  - `TERM-001` / `693921eb-d28d-4c1b-af17-087b589c6467`
  - perfil `local-terminal` / `e186b5bd-4873-49bb-9450-f141570cce80`
  - modo `HYBRID`
  - impresora `usb-printer-1f0028d1fa5243c2`
- V071 creó FK `ON DELETE RESTRICT`, índice lookup, unicidad parcial y
  trigger tenant/sucursal/activo. La segunda ejecución devolvió
  `ALREADY_APPLIED`.
- TERM-002 no recibió perfil: una sucursal puede tener varias terminales y no
  se infiere configuración por tenant/sucursal.
- `sales.terminal_id`, `cash_registers.terminal_id` y
  `pos_user_sessions.terminal_id` conservaron sus conteos QA previos.
- Deuda separada: V046--V061 continúan ausentes de `migrations_history`; no
  fueron ejecutadas ni se alteró su historial.

**QA MANUAL: resolución TERM-001 -> XP-80 PASS.**

### Resolución canónica - validación técnica posterior a V071

- `resolve-current` ahora trata cualquier `terminalId` UUID como identidad
  operativa primero. Busca `terminals.id` dentro del tenant y luego el perfil
  por `pos_terminals.operational_terminal_id`.
- Prueba técnica `TERM-001`: resuelve el perfil `HYBRID`
  `e186b5bd-4873-49bb-9450-f141570cce80`, conserva
  `agentTerminalCode=local-terminal` y devuelve
  `printerDeviceId=usb-printer-1f0028d1fa5243c2`.
- Prueba técnica `TERM-002`: devuelve `OPERATIONAL_UNCONFIGURED` sin perfil,
  sin impresora y sin heredar la XP-80 de `TERM-001`.
- Un UUID operativo inexistente o de otro tenant devuelve error controlado;
  no puede continuar al default legacy `local-terminal`.
- Compatibilidad: `terminalId=local-terminal` de texto sigue resolviendo solo
  como flujo legacy/MOCK explícito.
- QA físico canónico: PASS. Reportería POS recibió la configuración ligada a
  `TERM-001`, mandó el `deviceId` configurado al Agent y la XP-80 imprimió por
  USB RAW con corte físico.
- Validación de Agent local: `POST /devices/discover` sigue encontrando
  `XP-80` con `usb-printer-1f0028d1fa5243c2`, `USB` y
  `THERMAL_80MM`. El proceso existente en `127.0.0.1:4050` pertenece a otra
  identidad de Windows y rechazó su reinicio con `Access denied`; por eso esta
  validación no declara que el proceso en ejecución sea el Agent actualizado.

### QA física canónica TERM-001 / XP-80 USB RAW - PASS

- `TERM-001 CANONICAL RESOLUTION`: PASS.
- `DIRECT PRINT`: PASS.
- `XP-80 USB RAW`: PASS.
- `PHYSICAL CUT`: PASS.
- `LEGACY FALLBACK`: NOT USED. `local-terminal` quedó únicamente como
  `agentTerminalCode` del perfil enlazado, no como criterio de resolución.

Topología QA ejecutada:

```text
Browser client      192.168.1.18
Manus services      192.168.1.14
Peripheral Agent    192.168.1.14
XP-80               USB en host del Agent
```

Topología objetivo para QA tipo producción:

```text
POS workstation     Browser + Peripheral Agent + XP-80 en 192.168.1.18
Remote/cloud        Manus Web + API + Reports
```

La impresora debe continuar conectada al host que ejecuta el Peripheral Agent;
el navegador no accede al USB directamente.

## QA P0 - Peripheral Agent portable Windows x64 - 2026-08-21

### Topologia certificada

```text
192.168.1.14  Manus Web :3000, API :4020, Reports :4021
192.168.1.18  Browser + Peripheral Agent portable local :4050 + XP-80 USB
```

- El Browser continuo consumiendo Manus desde `192.168.1.14`.
- Todas las llamadas del Agent usaron `http://127.0.0.1:4050` y
  `ws://127.0.0.1:4050/peripherals`, resueltos en el workstation
  `192.168.1.18`.
- No se uso `192.168.1.14:4050`.
- El paquete validado fue `ManusPeripheralAgent-win-x64-0.1.0`, con runtime
  Node embebido, bind loopback, allow-list de origen
  `http://192.168.1.14:3000`, RAW y corte certificado habilitados.

### Resultado de impresion directa

`POST http://127.0.0.1:4050/printer/print-ticket` confirmo:

```text
success                              true
mode                                 REAL
adapterName                          UsbRawPrinterAdapter
deviceId                             usb-printer-1f0028d1fa5243c2
connectionType                       USB
capabilities.supportsPhysicalCut     true
bytesSent                            1245
```

- `WINDOWS X64 PORTABLE AGENT = HARDWARE CERTIFIED`.
- `LOCALHOST AGENT TOPOLOGY = PASS`.
- `WEB REMOTE + LOCAL HARDWARE = PASS`.
- `XP-80 USB RAW = HARDWARE CERTIFIED`.
- `PHYSICAL CUT = HARDWARE CERTIFIED`.
- Impresion, ticket completo, layout `THERMAL_80MM`, importes, footer, feed y
  corte fisico: PASS.

### Resolucion de periferico

- `TERM-001` mantuvo su asociacion canonica hacia el perfil periferico y el
  `printerDeviceId` existente `usb-printer-1f0028d1fa5243c2`.
- No se modificaron DB, V071, ventas, caja, sesiones ni configuracion de
  perifericos durante esta QA.
- `local-terminal` no fue fallback de resolucion. Permanece solo como
  `agentTerminalCode` transitorio.

## Preparacion E2E produccion web + Agent loopback - 2026-08-31

Esta fase es nueva. No reemplaza ni invalida la cronologia de QA fisica
anterior. Su topologia objetivo es especificamente:

```text
https://apptiendamanus.space
  -> http://127.0.0.1:4050
  -> impresora instalada en Windows
```

Cambios preparados en fuente:

- `PERIPHERALS_MODE` acepta `MOCK` y `REAL`; valores ausentes o invalidos
  conservan el fallback seguro `MOCK`.
- La configuracion JSON local acepta `mode` y lo mapea a
  `PERIPHERALS_MODE`.
- Discovery reporta el modo efectivo. En `REAL`, un fallo fisico deja error
  explicito y no devuelve mocks como fallback. Cero resultados sigue siendo
  un resultado valido y distinguible.
- El inventario Windows registra solo `Name`, `Type`, `PortName`,
  `DriverName` y `Shared`; el filtro fisico permanece limitado a colas
  `Local` con puertos `USB*` o `DOT4USB*` hasta obtener evidencia del equipo.
- CORS permite exactamente `https://apptiendamanus.space` y
  `http://localhost:3000` por defecto. El preflight PNA autorizado responde
  `Access-Control-Allow-Private-Network: true`.
- Web usa `http://127.0.0.1:4050` y
  `ws://127.0.0.1:4050/peripherals` como defaults, incluso en produccion.
  Los env publicos quedan como overrides tecnicos.

Validacion automatizada de esta fase:

- Backend tests: `84 PASS`, `0 FAIL`.
- Backend build: `PASS`.
- Web peripherals tests: `20 PASS`, `0 FAIL`.
- Web lint: `PASS` con warnings preexistentes fuera del alcance.
- Web build: `PASS`.

No se genero installer nuevo. No se modifico el change OpenSpec pausado. La
configuracion del Agent instalado y el despliegue web todavia deben aplicarse
manualmente para ejecutar la prueba.

**PHYSICAL PRINT: NOT TESTED / NOT PASS.**
