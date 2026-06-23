# Evidencia QA - Arqueo caja y desglose por medios de pago

Fecha: 2026-06-22

## Alcance

- Arqueo preliminar de caja abierta.
- Desglose por medio de pago.
- Cierre de caja con efectivo esperado claro.
- Ticket de cierre con resumen por medios.

## Casos

- [ ] Caja abierta sin operaciones: arqueo muestra apertura y diferencia con contado.
- [ ] Venta en efectivo: aumenta efectivo esperado.
- [ ] Venta con transferencia/tarjeta: no aumenta efectivo fisico y aparece por medio.
- [ ] Compra/egreso en efectivo: reduce efectivo esperado.
- [ ] Compra/egreso por transferencia: no reduce efectivo fisico y aparece por medio.
- [ ] Domicilio entregado en efectivo: suma solo `delivery_fee`.
- [ ] Domicilio entregado por transferencia: no suma efectivo y aparece por medio.
- [ ] Domicilio cancelado/no entregado: no suma.
- [ ] Arqueo calcula diferencia sin cerrar caja.
- [ ] Guardar arqueo mantiene caja abierta.
- [ ] Cierre muestra desglose claro antes de cerrar.
- [ ] Ticket cierre incluye desglose por metodo y domicilios.
- [ ] Ticket no duplica venta/pedido.

## Resultado

`V068__cash_session_audits_breakdown.sql` aplicada localmente para QA manual el 2026-06-22.

Verificado en DB local:

- `cash_counts.breakdown_json`: `jsonb`.
- `cash_counts.count_type`: `text`.
- Indice `idx_cash_counts_session_type_counted_at`: existe.
- `migrations_history`: `V068__cash_session_audits_breakdown.sql:true`.

## Validaciones tecnicas

- `cd api && npx.cmd tsx --test src\modules\finance\cash-sessions\cash-sessions.service.spec.ts`: PASS.
- `cd api && npm.cmd run build`: PASS.
- `cd backend-reporteria && npx.cmd tsx --test src\modules\reports\cash-reports.controller.spec.ts src\modules\reports\current-shift-reports.service.spec.ts`: PASS.
- `cd backend-reporteria && npm.cmd run build`: PASS.
- `cd web && npm.cmd run lint`: PASS con warnings preexistentes.
- `cd web && npm.cmd run build`: PASS con warnings preexistentes.
- `openspec.cmd validate implementar-arqueo-caja-y-desglose-medios-pago --type change --strict`: PASS.
- `openspec.cmd validate --all --strict`: PASS.
- `git diff --check`: PASS con avisos CRLF.
