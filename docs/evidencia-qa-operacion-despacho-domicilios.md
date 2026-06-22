# Evidencia QA - Operacion despacho domicilios

Fecha: 2026-06-22
Rama: `feat/develop/cierre-funcionalidad-de-domicilios`
OpenSpec: `cerrar-operacion-despacho-domicilios`

## Alcance validado

- Seleccion de repartidor activo durante creacion de domicilio.
- Asignar, cambiar o quitar repartidor despues de crear domicilio.
- Ticket operativo de domicilio via `backend-reporteria`.
- Ticket separado de pedido/venta fiscal.

## Casos QA manual

1. Crear repartidor activo.
   - Estado: pendiente de QA manual.
   - Resultado esperado: repartidor aparece activo en `/{tenant}/deliveries/drivers`.

2. Crear domicilio manual seleccionando repartidor.
   - Estado: pendiente de QA manual.
   - Resultado esperado: domicilio queda creado con `driver_id` y estado `CREADO`.

3. Confirmar domicilio creado con repartidor.
   - Estado: pendiente de QA manual.
   - Resultado esperado: listado y detalle muestran nombre/telefono del repartidor.

4. Crear domicilio desde pedido seleccionando repartidor.
   - Estado: pendiente de QA manual.
   - Resultado esperado: conserva `order_id`, guarda `driver_id`, no crea duplicado.

5. Confirmar estado no cambia por asignacion.
   - Estado: cubierto por test backend; pendiente de QA manual visual.
   - Resultado esperado: asignar repartidor no cambia estado operativo.

6. Cambiar repartidor desde detalle.
   - Estado: pendiente de QA manual.
   - Resultado esperado: detalle muestra `Cambiar repartidor` y actualiza el repartidor.

7. Quitar repartidor.
   - Estado: pendiente de QA manual.
   - Resultado esperado: seleccionar `Sin repartidor` limpia `driver_id`.

8. Confirmar repartidor visible en listado.
   - Estado: pendiente de QA manual.
   - Resultado esperado: columna Repartidor muestra nombre o `-`.

9. Confirmar filtro por repartidor.
   - Estado: cubierto por test backend/frontend previo; pendiente de QA manual.
   - Resultado esperado: `driver_id` filtra la lista.

10. Generar ticket de domicilio.
    - Estado: pendiente de QA manual.
    - Resultado esperado: boton `Ticket domicilio` abre PDF con opciones Descargar/Imprimir.

11. Ticket muestra cliente, telefono, direccion, pedido/venta, repartidor y valor.
    - Estado: cubierto por test backend-reporteria de dataset; pendiente de inspeccion PDF manual.

12. Generar ticket para domicilio con pedido.
    - Estado: cubierto por test backend-reporteria de dataset; pendiente de QA manual.

13. Generar ticket para domicilio con venta.
    - Estado: cubierto por test backend-reporteria de dataset; pendiente de QA manual.

14. Confirmar ticket de pedido/venta existente sigue funcionando.
    - Estado: pendiente de QA manual.
    - Resultado esperado: tickets existentes no cambian; se imprimen en secuencia con ticket domicilio.

15. Confirmar que caja/recaudo/pagos/fiscal no cambian.
    - Estado: cubierto por alcance tecnico y tests de no mutacion; pendiente de QA manual integral.

## Validaciones tecnicas

- `api`: `npx.cmd tsx --test src\modules\deliveries\deliveries.service.spec.ts src\modules\deliveries\delivery-drivers.service.spec.ts`
  - Resultado: PASS.

- `backend-reporteria`: `npx.cmd tsx --test src\modules\reports\deliveries-reports.service.spec.ts`
  - Resultado: PASS.

- `web`: `npx.cmd tsx --test modules\deliveries\*.spec.ts`
  - Resultado: PASS.

## Confirmaciones de alcance

- Caja/recaudo tocado: NO.
- Pagos tocados: NO.
- Facturacion fiscal/electronica tocada: NO.
- POS tocado: NO.
- Inventario tocado: NO.
- ESC/POS tocado: NO.
- SQL destructivo: NO.
- Commit realizado: NO.
