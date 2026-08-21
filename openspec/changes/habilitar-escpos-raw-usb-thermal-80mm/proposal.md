## Why

La impresión directa USB de la XP-80 usa actualmente GDI
`System.Drawing.Printing.PrintDocument`. Ese camino entrega texto al driver
sin un ancho térmico controlado ni comandos ESC/POS RAW, por lo que el ticket
puede recortarse a la derecha y no puede ejecutar corte físico.

La impresión directa desde Reportería POS ya llega correctamente al
Peripheral Agent. Ahora se necesita que el Agent renderice un documento
`THERMAL_80MM` seguro y lo transporte como ESC/POS RAW cuando la cola Windows
lo permita, manteniendo un fallback GDI explícito y honesto.

## What Changes

- Agregar un renderer térmico ESC/POS compartido por USB RAW y NETWORK RAW.
- Definir un layout textual seguro para `THERMAL_80MM`: 80 mm nominales,
  aproximadamente 72 mm imprimibles y 68 mm de contenido seguro.
- Agregar adapter USB RAW Windows mediante spooler, identificado por la cola
  descubierta y sin IDs de fabricante hardcodeados.
- Hacer configurable el transporte USB: RAW preferido o fallback GDI
  explícitamente habilitado.
- Reportar capacidades reales de corte físico por adapter, sin inferir PASS
  de hardware.
- Conservar contratos `POST /printer/test-print` y
  `POST /printer/print-ticket`, ventas, pagos, impuestos, inventario y la
  configuración de terminales sin cambios.

## Capabilities

### New Capabilities

- `usb-raw-escpos-thermal-printing`: Renderizado seguro `THERMAL_80MM` y
  transporte USB RAW ESC/POS mediante spooler Windows, con fallback GDI
  controlado y capacidades veraces.

### Modified Capabilities

- None.

## Impact

- Afecta `backend-perifericos`: renderer térmico, adapters USB/NETWORK,
  configuración, capacidades y pruebas.
- Afecta evidencia QA de la XP-80.
- No agrega dependencias nativas, SQL, migraciones ni cambios a APIs de
  negocio.
