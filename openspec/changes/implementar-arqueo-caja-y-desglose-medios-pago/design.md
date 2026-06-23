# Design

## Diagnostico

- Existe tabla `cash_counts`; se usa al cerrar caja para registrar contado, esperado y diferencia.
- No existe endpoint especifico de arqueo preliminar.
- El cierre actual usa `finance_cash_session_summary` y no separa claramente efectivo fisico contra pagos no efectivo.
- `payment_methods.tipo` existe y permite clasificar metodos como `CASH`, `CARD`, `BANK`, `DIGITAL`, `CREDIT`.
- Compras, ventas y pedidos usan `payments` con `payment_method_id`, `direction`, `reference_type` y `cash_session_id`.
- Domicilios tienen `payment_method_id`, `delivery_fee` y `cash_session_id`.
- El ticket de cierre sale de backend-reporteria y usa payload de reporting SQL mas normalizaciones del servicio.

## Decision

El arqueo queda persistente minimo reutilizando `cash_counts`.

Se agrega:

- `cash_counts.count_type`, default `CLOSING`.
- `cash_counts.breakdown_json`, snapshot del desglose.

Los arqueos preliminares guardan `count_type = 'AUDIT'`. El cierre guarda `count_type = 'CLOSING'`.

## Modelo de efectivo esperado

```text
efectivo_esperado =
  apertura_efectivo
+ pagos IN en efectivo
+ domicilios entregados con metodo efectivo
+ movimientos manuales IN
- pagos OUT en efectivo
- movimientos manuales OUT
```

Los pagos no efectivo no aumentan ni reducen el efectivo fisico esperado. Se muestran separados.

## Clasificacion de medios

- `CASH` => efectivo fisico.
- `CARD`, `CREDIT`, `DEBIT` => tarjeta.
- `BANK`, `TRANSFER` => transferencia.
- `DIGITAL`, `WALLET`, `NEQUI`, `DAVIPLATA` => billetera digital.
- Otros => otros.

## Doble conteo

- Pagos en `payments` se agregan por metodo y origen.
- Movimientos `PAYMENT`, `OPENING` y `CLOSING` no se cuentan como movimientos manuales.
- Domicilios suman solo `delivery_fee`.
- Domicilios no suman subtotal de pedido ni total de venta.

## API

- `GET /api/finance/cash-sessions/:id/audit-preview`
- `POST /api/finance/cash-sessions/:id/audits`
- `GET /api/finance/cash-sessions/:id/audits`

El preview comparte el mismo resumen enriquecido que el cierre.

## UI

La vista `/{tenant}/finance/cash-sessions` agrega accion `Arqueo` cuando la caja esta abierta. El modal muestra efectivo esperado, efectivo contado, diferencia preliminar, desglose por medios y observaciones.

## ReporterIa

El ticket de cierre incluye secciones:

- Resumen efectivo
- Resumen por medio de pago
- Resumen operativo
- Domicilios

Mantiene compatibilidad si el payload anterior no incluye el desglose nuevo.
