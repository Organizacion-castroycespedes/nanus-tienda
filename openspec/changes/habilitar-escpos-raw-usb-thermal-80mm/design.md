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

`supportsPhysicalCut` para USB RAW solo es true cuando
`PERIPHERALS_USB_RAW_PHYSICAL_CUT_CERTIFIED=true` se habilita después de QA
observada. Antes de eso RAW puede mandar `CUT` para QA, pero la capability
permanece false. La respuesta confirma envío al spooler/transport, no corte
físico; QA manual es la única evidencia de corte real.

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
4. Solo tras corte observado, definir
   `PERIPHERALS_USB_RAW_PHYSICAL_CUT_CERTIFIED=true` y reiniciar.
5. Para rollback, definir `PERIPHERALS_USB_PRINT_TRANSPORT=GDI` y reiniciar.

## Open Questions

- La XP-80 puede requerir code page distinta para caracteres fuera de Latin-1;
  esta entrega no cambia code page por modelo.
