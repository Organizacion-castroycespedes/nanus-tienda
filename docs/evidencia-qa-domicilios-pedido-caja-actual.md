# Evidencia QA - Domicilios desde pedido con caja actual

## Objetivo

Validar que un domicilio creado desde un pedido operativo quede visible en `cash_scope=current` aunque `delivery_fee = 0`.

## Resultado tecnico

- `POST /api/orders/:id/delivery` requiere caja abierta.
- Domicilio creado desde pedido guarda `cash_session_id`, `cash_register_id` y `terminal_id`.
- `cash_impact_amount` queda igual a `delivery_fee`.
- Si `delivery_fee = 0`, no suma cierre.
- Pedido de otra caja/sesion se rechaza.
- Domicilio existente inicial sin caja se completa con caja actual sin duplicar.

## Casos QA

### 1. Caja abierta

- Crear pedido.
- Crear domicilio desde pedido.
- Confirmar response con `cash_session_id`, `cash_register_id`, `terminal_id`.
- Entrar a Domicilios con `cash_scope=current`.
- Confirmar domicilio visible.
- Asignar repartidor.
- Confirmar estado sigue `CREADO`.

Estado: pendiente QA manual.

### 2. `delivery_fee = 0`

- Crear domicilio desde pedido con valor domicilio `0`.
- Confirmar que aparece en caja actual.
- Confirmar `cash_impact_amount = 0`.
- Confirmar cierre no suma valor adicional.

Estado: cubierto por test backend; pendiente QA manual de cierre.

### 3. Pedido historico sin caja

- Usar pedido sin `cash_session_id`.
- Crear domicilio desde caja actual.
- Confirmar asociacion a caja actual.
- Confirmar metadata `source_order_without_cash_session = true`.

Estado: cubierto por test backend; pendiente QA manual.

### 4. Pedido de otra caja

- Intentar crear domicilio para pedido con otra `cash_session_id`.
- Confirmar error claro.
- Confirmar que no se reasigna silenciosamente.

Estado: cubierto por test backend; pendiente QA manual.

### 5. Duplicados

- Volver a crear domicilio para el mismo pedido.
- Confirmar que devuelve/completa existente cuando es seguro.
- Confirmar que no crea duplicado.

Estado: cubierto por test backend; pendiente QA manual.

## No regresion

- Facturacion fiscal/electronica tocada: NO.
- Pagos tocados: NO.
- Inventario tocado: NO.
- POS funcional tocado: NO.
- SQL destructivo: NO.
- Commit realizado: NO.
