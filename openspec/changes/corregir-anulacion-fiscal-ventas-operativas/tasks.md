# Tasks: corregir-anulacion-fiscal-ventas-operativas

- [x] 1. Centralizar los estados electrónicos usados para decidir si una factura está aceptada.
- [x] 2. Bloquear anulaciones de ventas con factura electrónica no `ACCEPTED`.
- [x] 3. Emitir y aplicar nota crédito solo para factura aceptada.
- [x] 4. Mantener anulación local para ventas sin factura electrónica.
- [x] 5. Revertir correctamente pagos, saldos y estado financiero de la venta.
- [x] 6. Mostrar decisiones, estados y mensajes fiscales en la interfaz.
- [x] 7. Cubrir los casos de backend y frontend con pruebas.
- [x] 8. Habilitar el worker de solicitudes de anulación en `api/.env.example`.
- [x] 9. Mantener la factura original en la proyeccion `INVOICE`, sin reemplazarla por otro tipo de documento.
- [x] 10. Mostrar `Anulada` visualmente para ventas terminales en listado y detalle, sin mutar estados persistidos.
- [x] 11. Cubrir venta normal, void local, venta terminal con factura y datos ausentes.
- [x] 12. Ejecutar validacion OpenSpec estricta, pruebas focalizadas, lint, typecheck y build pertinentes.
- [x] 13. Documentar como pendiente separado la asociacion durable y visualizacion del numero real de nota credito aceptada.
