## Context

`POST /printer/print-ticket` ya recibe el dataset canónico de la venta y
llega al Peripheral Agent. NETWORK convierte el documento textual actual en
bytes ESC/POS por TCP. USB, en cambio, usa PowerShell y
`System.Drawing.Printing.PrintDocument`, con `Consolas` 8 y coordenadas GDI
sin un ancho físico térmico. El resultado confirmado es impresión física,
pero clipping derecho y sin corte.

El perfil existente `THERMAL_80MM` declara 48 caracteres y corte conceptual.
El layout PDF también declara 80 mm nominales, 72 mm imprimibles y 68 mm
seguros. Browser/PDF no participa en este camino directo.

## Goals / Non-Goals

**Goals:**

- Renderizar contenido canónico a un documento ESC/POS de ancho seguro para
  `THERMAL_80MM`.
- Reutilizar ese renderer para USB RAW y NETWORK RAW.
- En Windows, enviar bytes a la cola descubierta con spooler RAW:
  `OpenPrinter`, `StartDocPrinter`, `StartPagePrinter`, `WritePrinter`,
  `EndPagePrinter`, `EndDocPrinter`, `ClosePrinter`.
- Hacer el uso de GDI una degradación explícita, con capability de corte
  físico falsa.
- Mantener los mismos endpoints y el aislamiento del navegador frente a bytes
  ESC/POS.

**Non-Goals:**

- No cambiar ventas, pagos, impuestos, inventario, terminales ni persistencia.
- No hardcodear fabricante, vendor ID, product ID, device ID ni cola.
- No certificar corte ni hardware sin QA físico posterior.
- No implementar cajón, scanner, balanza ni USB RAW en Linux/macOS.

## Decisions

### Renderer ESC/POS compartido

Crear un renderer puro que recibe el documento térmico canónico y devuelve
preview, comandos conceptuales y bytes ESC/POS. Usa 48 columnas monoespacio
como representación segura de aproximadamente 68 mm de contenido, wrapping
de palabras/tokens largos, importes a la derecha y feed final.

NETWORK y USB RAW reciben exactamente esos bytes. Esto evita que GDI, TCP y
cada adapter calculen columnas distintas.

Alternativa: reutilizar el PDF o HTML. Rechazada: introduce escala del driver,
browser o GDI y no entrega bytes ESC/POS.

### USB RAW por spooler Windows sin dependencia nativa

El adapter ejecuta un script PowerShell encapsulado. El script declara P/Invoke
Win32 con `Add-Type`, valida la cola por nombre y escribe el buffer base64 al
spooler como datatype `RAW`. La cola proviene exclusivamente del discovery
USB. El adapter es inyectable en tests.

Alternativa: agregar paquete NPM nativo. Rechazada: complejidad de instalación,
ABI y empaquetado mayor para el primer MVP Windows.

### Estrategia USB y fallback

`PERIPHERALS_USB_PRINT_TRANSPORT=RAW` es el modo Windows esperado. Si RAW
falla, no hay fallback automático: se registra error controlado. Solo
`PERIPHERALS_USB_PRINT_TRANSPORT=GDI` permite el adapter GDI legado de forma
explícita. En plataformas no Windows RAW retorna error controlado; GDI/CUPS
es una decisión de configuración explícita.

Esto impide ocultar una degradación y evita declarar corte cuando no existe.

### Corte y capabilities

El renderer agrega `GS V 0` después del feed solo si el profile soporta corte
y el transporte es RAW. `supportsCut` significa capacidad del perfil;
The final `FEED` is encoded as `ESC d 6`, rather than two line feeds, so the
spooler sequence is `BODY -> FOOTER -> FINAL FEED -> CUT`. This advances the
paper below the footer before `GS V 0` is processed.

The current USB adapter reports `supportsPhysicalCut=false` for both RAW and
GDI. The legacy global `PERIPHERALS_USB_RAW_PHYSICAL_CUT_CERTIFIED` setting
does not enable that capability. RAW still transmits feed/cut when the profile
supports cutting; this is separate from capability reporting and physical QA.
Spooler submission alone does not prove physical cutting. Drawer pulse uses
its independent per-device `usbRawCashDrawerPulseCertified` safeguard.

Operator evidence recorded 2026-10-16 (date of this QA session; the exact
physical-test timestamp was not supplied): the user reports canonical XP-80
`usb-printer-1f0028d1fa5243c2`, Windows queue `XP-80`, printed a complete,
readable ticket, advanced paper and cut once with
`PERIPHERALS_USB_PRINT_TRANSPORT=RAW`. The user separately reports physical
cash drawer opening. Codex did not independently reproduce these operations.
These observations apply to that QA setup only, do not certify all devices,
and do not change cutter capability reporting or drawer authorization metadata.

## Risks / Trade-offs

- [Driver no acepta datatype RAW] → devolver error controlado y permitir GDI
  solo con configuración explícita.
- [Code page ESC/POS no representa todos los caracteres] → usar texto
  normalizado Latin-1 inicial y documentar code pages como deuda posterior.
- [48 columnas varía por fuente de firmware] → ancho seguro, wrapping y QA
  físico en XP-80; no depender de GDI scaling.
- [Spooler acepta bytes pero firmware ignora CUT] → no marcar QA de corte
  PASS hasta observación física.

## Migration Plan

1. El comportamiento USB actual se conserva solo cuando `GDI` se configura
   explícitamente.
2. En el host Windows aprobado, definir RAW y reiniciar el Agent.
3. Ejecutar test print y ticket directo; validar contenido y corte físico.
4. Record observed cutting separately from the conservative USB capability;
   do not enable capability reporting through the legacy global variable.
5. Para rollback, definir `PERIPHERALS_USB_PRINT_TRANSPORT=GDI` y reiniciar.

The QA RAW setting was a runtime launch/session choice. A Git commit or code
deployment does not persist it. Reproduction requires a separately authorized
launch configuration selecting RAW explicitly, the same verified canonical
device/queue/profile, and independent drawer certification. No environment
file, machine credential or runtime configuration is stored by this increment.

## Open Questions

### QA_PRINT_18 Windows relationship proof

QA_PRINT_21 narrows the present-device pipeline before expensive property acquisition: retain only USB instance IDs with Class_07 compatible IDs, plus USBPRINT instance IDs. Generic USB class membership alone is not sufficient. Parent/Children/ContainerId queries remain downstream of this filter. The 7000 ms command budget, serial inventory and exact correlation checks remain unchanged. This removes irrelevant property work; it does not prove which subquery caused the observed timeout or guarantee runtime latency. Mock/static validation and physical QA remain distinct.

Extend the existing read-only PnP inventory with USBPRINT nodes and DEVPKEY_Device_Parent, Children and ContainerId properties. Support only the observed USBPRINT instance form ending in an exact `&USB<number>` port; other forms remain uncorrelated. Require unique queue name/port, a unique present/OK USBPRINT and parent, reciprocal child identity, equal nonzero GUID containers, and parent VID/PID consistency with hardware IDs. Publish proof in queue fingerprint metadata. Reconciliation substitutes the proven parent as the queue's physical matching key, then retains the original queue descriptor's ID when normalizing a correlated result. Existing configured-device merge preserves profile/association. Missing proof leaves the existing fail-closed path; runtime status follows the computed discovered status. No printing, pulse, scale, authentication or runtime operation is part of this change.

### QA_PRINT_08 diagnostics boundary

Use a typed HTTP diagnostic exception for USB print and drawer failures. Command failures use Node error codes and reserved PowerShell exit codes (41 invalid queue, 42 spooler submission, 43 process failure). Unknown errors stay generic; stderr and arbitrary exception messages are never classified or returned. Print failures retain HTTP 400; drawer unexpected transport failures retain HTTP 500. Existing logging records only safe categories and bounded non-secret device/queue identity plus configured transport. Client allowlists are explicit and checked for parity. No live QA action or hardware certification is part of this increment.

QA_PRINT_08S scopes reserved statuses to an explicit Agent-owned Windows USB RAW/GDI command context. Other command sources, including Unix lp, use generic nonzero-process classification. Metadata records connectionType; RAW/GDI configuredTransport and bounded expectedQueue apply only to USB. NETWORK and other connections retain their existing connection category as transport. USB drawer transport remains RAW. This changes diagnostics only, not job submission or payloads.

- La XP-80 puede requerir code page distinta para caracteres fuera de Latin-1;
  esta entrega no cambia code page por modelo.
