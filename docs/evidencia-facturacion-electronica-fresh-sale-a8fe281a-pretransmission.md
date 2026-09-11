# Evidencia: venta QA controlada antes de transmisión

## Alcance

Se inspeccionó únicamente la venta `a8fe281a-1763-4148-875b-19bd99a29c2d` en QA. No se creó evento manual, documento Manus, documento FactuCore, XML ni firma. No hubo llamada DIAN.

## Guardas

- Rama Manus: `feat/develop/implementando-facturacion-electronica`.
- HEAD: `7352ea7`.
- Base de datos leída: `manus_tienda_qa`, esquema `public`.
- Venta encontrada: sí; estado `CONFIRMED`; total pagado coincide con total.
- La venta pertenece al tenant QA esperado y tiene cliente asociado.
- El documento terminal `SETP990000006` no fue tocado.

## Bloqueo de flujo

La consulta controlada no encontró registro `SALE_COMPLETED_FOR_ELECTRONIC_BILLING` en `integration_outbox_events` para esta venta. Sin snapshot inmutable no es seguro entregar el evento ni construir el documento fiscal: hacerlo manualmente podría omitir datos de cliente, líneas, impuestos o pagos.

No se encontró un endpoint soportado de replay individual. Por seguridad, el flujo termina antes de cualquier mutación.

## Normalización ya validada

El mapper FactuCore mantiene `CASH -> paymentMeansCode "10" / paymentMeansId "1"`, con pruebas locales de 142/142 y OpenSpec 80/80. Esta venta no alcanzó el mapper.

## Resultado

- Outbox entregado: 0.
- Documento Manus nuevo: no creado.
- Documento FactuCore nuevo: no creado.
- XML generado: 0.
- Firma: 0.
- Transmisión DIAN: 0.
- Workers permanecen deshabilitados; PG-BOSS permanece quiescente.

## Siguiente paso seguro

Implementar o autorizar un mecanismo soportado de reconstrucción/reemisión del evento para una sola venta, con snapshot validado, antes de crear el documento fiscal.
