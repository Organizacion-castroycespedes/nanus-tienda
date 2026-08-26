## Why

Reporteria POS actualmente muestra un ticket PDF y su modal usa el dialogo de
impresion de Chrome. La XP-80 USB ya funciona mediante Peripheral Agent, pero
la reimpresion desde reportes no usa la impresora configurada de la terminal.
Se necesita separar preview de impresion directa, sin mutar la venta ni usar
un fallback MOCK silencioso.

## What Changes

- Separar `Ver ticket` de `Imprimir` en la tabla de Reporteria POS y retirar
  imprimir del modal PDF.
- Exponer el dataset canonico de ticket POS para enviar contenido termico al
  Agent, sin leer HTML, PDF o calculos duplicados.
- Resolver la impresora real de la terminal POS actual del operador usando la
  configuracion persistida existente.
- Rechazar terminal sin impresora real configurada y mostrar errores
  controlados de Agent/dispositivo/cola.
- Descubrir colas USB al iniciar el Agent cuando los adapters reales estan
  habilitados.
- Declarar que el adapter USB de cola del sistema no garantiza corte fisico.

## Decision

Una reimpresion historica usa la terminal POS actual del operador. No usa la
terminal original de la venta: esa terminal puede estar apagada, en otra caja o
no ser la impresora junto al usuario que solicita la reimpresion. La venta se
lee como fuente de datos inmutable; la terminal actual solo decide destino.

## Non-Goals

- No modificar ventas, pagos, impuestos, descuentos, inventario o fiscal.
- No agregar SQL ni migraciones. Se reutiliza `pos_terminal_peripheral_settings`.
- No implementar USB RAW ESC/POS ni corte fisico.
- No implementar scanner, balanza o cajon.

## Impact

- `web` Reporteria y contratos de perifericos.
- `backend-reporteria` endpoint JSON de dataset canonico.
- `backend-perifericos` bootstrap USB, contenido termico y capabilities.
