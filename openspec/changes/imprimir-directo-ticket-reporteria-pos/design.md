## Current flow

Preview actual:

```text
Reporteria web -> GET ticket PDF -> iframe -> Chrome print dialog -> Windows driver
```

Impresion directa propuesta:

```text
Reporteria web -> GET ticket data canonico -> resolve current terminal
  -> POST local Agent /printer/print-ticket -> USB system queue -> XP-80
```

El PDF no viaja al Agent. El Agent recibe contenido termico estructurado.

## Terminal policy

La terminal de la venta aparece en el dataset historico, pero no es destino
automatico. La accion usa la terminal POS activa del navegador. Web pasa su
`terminalId`, tenant y sucursal al resolver configuracion. Si Reporteria no
posee `terminalId` en Redux/localStorage, `resolve-current` resuelve la
terminal activa por defecto de la sucursal antes de decidir el dispositivo.
Si no hay terminal real configurada con `printerDeviceId` no mock, la accion
falla como `PRINTER_NOT_CONFIGURED`; nunca usa el fallback mock para imprimir.

`pos_terminal_peripheral_settings` ya persiste el identificador de impresora.
El descriptor USB actual genera un ID estable a partir del nombre de cola. El
Agent debe redescubrir las colas al iniciar para reconstituir el estado en
memoria; renombrar la cola requiere reasociacion.

## Canonical ticket data

`SalesReportsService.getSaleTicket()` ya normaliza el dataset autorizado de
venta. Se expone una ruta JSON protegida para esa misma salida. Web la mapea a
`PeripheralTicketPayload` sin recalcular importes: items, pagos, subtotal,
impuestos, total, pagado, cambio y saldo se copian desde el dataset.

## USB transport and cut

`UsbSystemPrinterAdapter` entrega texto a `System.Drawing.Printing.PrintDocument`.
La cola puede aceptar el trabajo, pero no recibe bytes ESC/POS RAW. Por eso sus
capabilities reportan `supportsPhysicalCut: false`; `CUT` conceptual no es
evidencia de corte. Deuda explicita: USB RAW ESC/POS + physical CUT.

## Failure behavior

- Agent offline: venta no cambia; UI muestra Agent no disponible.
- Terminal/impresora no configurada: UI no llama al Agent.
- Queue USB ausente: Agent devuelve device-not-found y emite job failed.
- Timeout/fallo de cola: UI muestra envio fallido; no dice que papel imprimio.
- Exito: UI dice `Ticket enviado a la impresora`.

## Browser print remains separate

`Ver ticket` conserva preview, cerrar y descargar. No contiene boton imprimir.
El nuevo boton de tabla llama Agent directo y nunca abre iframe, preview o
dialogo Chrome.
