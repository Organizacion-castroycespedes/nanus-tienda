# Electron receipt printing Windows

Fecha: 2026-06-20  
OpenSpec change: `preparar-impresion-recibos-electron-windows`

## Objetivo

Preparar la estrategia inicial de impresion de recibos/tickets para Manus POS Electron Windows usando impresion estandar web/Windows.

Esta fase no agrega impresion nativa nueva. Documenta como usar lo que ya existe en la web y deja `webContents.print` como evolucion futura controlada.

## Alcance

- Analizar flujos de impresion existentes en `web/`.
- Definir estrategia inicial para Electron Windows.
- Diferenciar recibo, ticket, factura, comprobante de caja y documento fiscal.
- Documentar `window.print` y la impresion estandar Windows/web.
- Documentar `webContents.print` como opcion futura.
- Documentar seguridad Electron para APIs futuras.
- Documentar configuracion futura por terminal.
- Crear evidencia QA documental.

## Fuera de alcance

- Backend.
- SQL/migraciones.
- Permisos reales.
- Logica de negocio.
- Flujo de venta.
- Flujo de caja.
- Pedidos.
- Facturacion fiscal/electronica.
- ESC/POS.
- Gaveta monedera.
- Impresora fiscal.
- SDKs/librerias de impresora.
- Impresion silenciosa obligatoria.
- Offline.
- Sincronizacion.
- Cambios funcionales de empaquetado.

## Busqueda de flujos existentes en web

Comandos usados:

```powershell
rg -n "window\.print|\.print\(|print\(\)" web
rg -n "receipt|recibo|ticket|imprimir|print|factura|invoice|voucher|comprobante" web
rg -n "@media print|print:" web
rg --files web | rg "receipt|recibo|ticket|print|invoice|factura|voucher|comprobante"
```

Hallazgos principales:

| Archivo | Flujo encontrado |
| --- | --- |
| `web/modules/reporteria/components/PdfPreviewModal.tsx` | Modal PDF con boton `Imprimir` usando `iframeRef.current?.contentWindow?.print()`. |
| `web/app/[tenant]/finance/current-shift/page.tsx` | Tickets del turno actual abren PDF en ventana y usan `printWindow.print()`. |
| `web/app/[tenant]/finance/cash-sessions/page.tsx` | Tickets de cierre de caja usan `printWindow.print()`; tambien se intenta impresion automatica despues de cerrar caja exitosamente. |
| `web/app/[tenant]/purchases/page.tsx` | Vista previa de ticket de compra en iframe con `contentWindow.print()`. |
| `web/modules/reporteria/services/reporting.service.ts` | Servicios PDF para tickets de ventas POS, cierres, arqueos, compras y pedidos. |
| `web/domains/peripherals/README.md` | Contratos mock/locales hacia `backend-perifericos`, no Electron; no deben confundirse con esta fase. |

No se encontro una plantilla Electron dedicada ni una API `preload` de impresion.

## Estrategia inicial recomendada

Para v0.0.1:

1. Mantener los tickets PDF generados por backend/reporteria como fuente imprimible.
2. Usar los flujos web existentes con `window.print`, iframes PDF o ventanas PDF.
3. En Electron Windows, ejecutar esos mismos flujos dentro del renderer Chromium.
4. No crear API Electron nueva mientras los flujos web actuales sean suficientes.
5. Dejar `webContents.print` para una fase futura con contrato explicito.
6. Mantener ESC/POS, gaveta, fiscal printer e impresion silenciosa fuera de alcance.

Decision: esta fase queda documental. No se toca codigo Electron ni frontend.

## Diferencia entre documentos

| Documento | Descripcion | Autoridad | Estado en esta fase |
| --- | --- | --- | --- |
| Recibo operativo no fiscal | Comprobante local o informativo de una operacion ya creada. | Web/API segun operacion origen. | Puede imprimirse con flujo web si ya existe. |
| Ticket POS | Representacion imprimible de venta POS o movimiento operativo. | Backend/reporteria genera PDF cuando aplica. | Ya hay tickets PDF en reporteria. |
| Factura/representacion impresa | Documento relacionado con facturacion o venta formal. | Backend/facturacion segun reglas existentes. | No se modifica. |
| Comprobante de caja | Ticket de cierre, arqueo o movimiento de caja. | Backend/reporteria. | Ya hay tickets de cierre/turno. |
| Documento fiscal/regulado | Documento sujeto a norma fiscal o proveedor certificado. | Regla fiscal/pais/proveedor. | Fuera de alcance. |

Imprimir no convierte un recibo en fiscal ni crea validez tributaria.

## Impresion estandar Windows/web

Base inicial:

- El renderer Electron puede usar `window.print`.
- Los iframes PDF pueden usar `contentWindow.print()`.
- Las ventanas PDF pueden usar `printWindow.print()`.
- Windows decide impresora, driver, papel y dialogo segun configuracion del usuario.

Ventajas:

- No requiere SDK.
- No requiere ESC/POS.
- No requiere permisos USB/serial.
- Reusa tickets existentes.
- No crea una superficie nativa nueva.

Limitaciones:

- Puede mostrar dialogo.
- Puede depender de popup permitido.
- Puede no estar optimizado para rollo termico.
- Margenes y papel dependen de Windows/driver.
- No abre gaveta.
- No imprime fiscal.

## Posible uso futuro de `webContents.print`

`webContents.print` puede ser util en una fase posterior para:

- Imprimir una vista controlada por Electron.
- Seleccionar impresora configurada por terminal.
- Ajustar opciones como silent, copias o margenes.
- Evitar depender de popup de navegador en algunos flujos.

Condiciones para usarlo:

- Definir contrato de preload estrecho.
- Validar payloads.
- No aceptar HTML arbitrario desde renderer sin control.
- No aceptar comandos del sistema.
- Configurar impresora por terminal.
- Registrar errores tecnicos sin datos sensibles.
- Mantener fallback manual.

No se implementa en esta fase.

## Seguridad Electron

Reglas para cualquier API futura:

- Mantener `contextIsolation: true`.
- Mantener `nodeIntegration: false`.
- No exponer Node completo al renderer.
- Usar preload separado.
- Exponer metodos estrechos, por ejemplo `printCurrentView` o `printTicketPdf`, solo si se aprueba.
- Validar payloads.
- No aceptar rutas arbitrarias del sistema.
- No aceptar comandos arbitrarios.
- No permitir impresion silenciosa sin configuracion explicita por terminal.
- No abrir gaveta desde impresion.
- No registrar datos sensibles en logs.

## Configuracion futura por terminal

Campos posibles para fase futura:

| Campo | Uso |
| --- | --- |
| Impresora predeterminada Windows | Nombre exacto de impresora instalada. |
| Impresora por terminal | Asociacion local terminal/impresora. |
| Tamano de papel | 58mm, 80mm, A4 u otro. |
| Margenes | Ajuste por driver/plantilla. |
| Copias | Numero de copias por documento. |
| Silent printing permitido | Flag explicito por terminal. |
| Plantilla de recibo | PDF backend, vista web o plantilla termica futura. |
| Apertura de gaveta | Separada de impresion y controlada por evento operativo. |

No se implementa persistencia local ni configuracion backend en esta fase.

## Riesgos

| Riesgo | Mitigacion |
| --- | --- |
| Popup bloqueado | Mantener fallback "Ver ticket" y boton manual. |
| Dialogo de impresion interrumpe caja | Evaluar `webContents.print` futuro. |
| Ticket PDF no cabe en rollo termico | Definir plantilla termica futura. |
| Usuario imprime documento equivocado | Mantener titulo, preview y descarga visibles. |
| Impresion se interpreta como factura fiscal | Documentar alcance no fiscal. |
| Impresion falla despues de cierre de caja | No revertir cierre; mostrar error operativo. |

## Decisiones

1. No se implementa API Electron de impresion en esta fase.
2. Se usa estrategia web/Windows como base inicial.
3. Los tickets PDF existentes son fuente imprimible inicial.
4. `webContents.print` queda futuro.
5. ESC/POS queda fuera de alcance.
6. Impresion silenciosa queda futura y requiere configuracion explicita.
7. Gaveta queda separada de impresion.
8. Fiscal printer queda fuera de alcance regulado.
9. Imprimir no muta estado de negocio.

## Fases futuras

1. QA manual de `window.print` en Electron empaquetado con tickets existentes.
2. Ajuste documental de impresoras Windows recomendadas.
3. Definir plantilla de ticket termico si PDF actual no basta.
4. Disenar API preload para `webContents.print`.
5. Implementar `webContents.print` con tests de payload/config.
6. Configurar impresora por terminal.
7. Evaluar impresion silenciosa por terminal autorizada.
8. Evaluar ESC/POS directo.
9. Evaluar gaveta por pulso de impresora.
10. Abrir proyecto separado para fiscal printer si aplica.

## QA manual esperado

Para marcar `PRINT_RUNTIME_PASS` en una fase futura:

- Levantar Electron Windows.
- Abrir ticket existente desde reporteria, turno, cierre de caja o compras.
- Probar boton `Imprimir`.
- Confirmar dialogo de Windows o impresion real.
- Registrar impresora, driver, papel, Windows, URL y documento usado.
- Confirmar que no se crea venta.
- Confirmar que no se crea factura.
- Confirmar que no se abre/cierra caja.
- Confirmar que no se abre gaveta.
- Confirmar que no se modifica inventario, pagos, impuestos, descuentos ni pedidos.

En esta fase el resultado es `PASS_DOCUMENTAL`.
