# Reconciliacion de pagos, caja y documentos

## Resumen

Se detectaron dos inconsistencias relacionadas:

1. Compras y pedidos quedaban financieramente pagados porque existian filas en `payments` y `payment_allocations`, pero no impactaban caja porque el pago no quedaba asociado a `cash_session_id` y tampoco generaba fila en `cash_movements`.
2. Los abonos heredados desde `SALES_ORDER` hacia `SALE` no reconciliaban de inmediato el estado financiero del pedido, lo que podia dejar el pedido con `payment_status` desactualizado despues de facturar la venta.

## Causa raiz

### Compras

- `purchases.total_paid`, `purchases.balance_due` y `purchases.payment_status` se calculan desde `payment_allocations`.
- El resumen de caja y los movimientos visibles dependen de:
  - `payments.cash_session_id`
  - `cash_movements`
- Si un pago `COMPLETED` se crea sin `cash_session_id`, el documento puede quedar pagado sin afectar caja.

### Pedidos y ventas

- La facturacion desde pedido reutiliza abonos de `SALES_ORDER`.
- Al mover asignaciones hacia `SALE`, se recalculaba la venta, pero no siempre el pedido.
- El resultado podia ser:
  - la venta con abono correcto
  - el pedido aun marcado como pagado o parcial con datos desactualizados

## Objetivos de la correccion

1. Evitar nuevos pagos completados sin sesion de caja cuando el metodo es `CASH`.
2. Mantener trazabilidad explicita entre `payments` y `cash_movements`.
3. Reconciliar de inmediato pedido y venta cuando se heredan abonos.
4. Dejar documentado el proceso de conciliacion historica para datos ya afectados.

## Cambios propuestos

### Frontend

- Bloquear pagos en efectivo sin caja activa.
- Mostrar contexto de caja actual en formularios de pagos.
- Mantener validacion tambien al facturar pedidos con pagos nuevos.

### Backend

- Crear `cash_movements` de pago con referencia directa a `payment_id`.
- Reconciliar el pedido despues de mover abonos heredados a la venta.
- Seguir rechazando pagos `CASH` completados sin `cashSessionId`.

### Base de datos

- Agregar `payment_id` nullable a `cash_movements`.
- Agregar FK hacia `payments`.
- Agregar indice unico parcial para evitar dos movimientos `PAYMENT` por el mismo pago.

## Conciliacion historica recomendada

### 1. Detectar pagos completados sin sesion de caja

```sql
SELECT
  p.id,
  p.reference_type,
  p.reference_id,
  p.direction,
  p.amount,
  p.status,
  p.cash_session_id,
  p.branch_id,
  p.created_at
FROM payments p
WHERE p.status = 'COMPLETED'
  AND p.reference_type IN ('SALES_ORDER', 'SALE', 'PURCHASE', 'PURCHASE_ORDER')
  AND p.cash_session_id IS NULL
ORDER BY p.created_at ASC, p.id ASC;
```

### 2. Detectar pagos con sesion pero sin movimiento de caja

```sql
SELECT
  p.id,
  p.reference_type,
  p.reference_id,
  p.direction,
  p.amount,
  p.cash_session_id
FROM payments p
WHERE p.status = 'COMPLETED'
  AND p.reference_type IN ('SALES_ORDER', 'SALE', 'PURCHASE', 'PURCHASE_ORDER')
  AND p.cash_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM cash_movements cm
    WHERE cm.payment_id = p.id
  )
ORDER BY p.created_at ASC, p.id ASC;
```

### 3. Reparar un pago historico

Pasos:

1. Identificar la sesion de caja correcta.
2. Actualizar `payments.cash_session_id`.
3. Insertar la fila faltante en `cash_movements`.
4. Verificar resumen de caja y estado del documento.

## Despliegue recomendado

1. Aplicar migracion de base de datos.
2. Desplegar backend.
3. Desplegar frontend.
4. Ejecutar conciliacion historica sobre compras y pedidos afectados.
5. Verificar:
   - `Pagos compras`
   - `Balance rapido`
   - `orders.payment_status`
   - `sales.payment_status`
   - `purchases.payment_status`

## Riesgos y notas

- Los pagos historicos sin `cash_session_id` no deben repararse automaticamente sin validar la sesion correcta.
- En pagos heredados desde pedidos a ventas, el efectivo ya existe una sola vez; lo que debe reconciliarse es el estado financiero del documento.
- La referencia documental visible en `cash_movements` puede requerir evolucion posterior si se desea mostrar la venta final en lugar del pedido origen. La nueva columna `payment_id` deja la trazabilidad lista para esa mejora.
