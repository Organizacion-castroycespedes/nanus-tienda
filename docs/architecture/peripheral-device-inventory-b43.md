# Inventario de dispositivos y adaptadores — B4.3

| Dispositivo | Rutas/módulos | Adaptador o transporte | Estado real |
|---|---|---|---|
| Impresora MOCK | `printer.controller/service.ts` | `MockPrinterAdapter` | Implementado y predeterminado |
| Impresora NETWORK | `/printer/test-print`, `/printer/print-ticket` | `NetworkEscposPrinterAdapter`, TCP/ESC-POS | Implementado, flag apagado por defecto |
| Impresora USB | mismas rutas | `UsbSystemPrinterAdapter`, cola Windows/GDI/RAW | Implementado en código; hardware no verificado |
| Cajón MOCK | `/cash-drawer/open` | `MockCashDrawerAdapter` | Simulado |
| Cajón por impresora | `/cash-drawer/open` | Pulso ESC/POS del adaptador de impresora | Configurado; certificación física pendiente |
| Scanner | `/scanner/simulate`; wedge Web | `ScannerService` + `pos-scanner-wedge` | Simulación/implementación Web |
| Balanza | `/scale/current-weight` | `ScaleService` | Simulado en código |
| Devices | `/devices`, `/devices/discover`, POST/PATCH | Registro en memoria y discovery local | Implementado; persistencia/ambiente pendiente |

## Conexiones aceptadas

`ConnectionType` admite `MOCK`, `USB`, `SERIAL`, `HID`, `USB_HID`, `NETWORK` y
`BLUETOOTH` como valores de modelo. El resolver solo entrega adaptador real para
`NETWORK + PRINTER` y `USB + PRINTER`. Otros tipos reales son rechazados o quedan
sin adaptador implementado.

## Impresión

El formatter produce preview textual y comandos `INIT`, alineación, feed, cut,
QR, imagen raster y pulso de cajón. El renderer ESC/POS convierte comandos a
bytes. RAW usa codificación `cp858`; GDI usa documento textual. El corte físico
USB no se anuncia automáticamente.

## Discovery y registro

El Agent descubre colas USB del sistema y CUPS según plataforma. No hace escaneo
automático de red ni garantiza identificación de fabricante/modelo. Los
dispositivos registrados pueden tener `profileId`, terminal, conexión, estado y
metadata de certificación.

## Restricciones

- Adapter real requiere `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- Host NETWORK no puede ser loopback y el timeout tiene límites.
- USB requiere cola del sistema; no usa WebUSB, `serialport` ni HID nativo.
- Apertura USB de cajón requiere metadata de certificación específica.
- La lectura de balanza actual no demuestra driver ni puerto físico.
