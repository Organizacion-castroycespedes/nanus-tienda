## Why

Con cuentas, planes y contratos ya operando (fase 1, PR aprobado), MANUS aún no sabe cuánto le debe cada cliente ni cuándo. Falta convertir los contratos en cargos por período, registrar los pagos recibidos y ver la cartera.

Decisiones del propietario (2026-11-08):

- cargos generados automáticamente por un proceso diario, con botón manual en la ficha del contrato;
- cobro anticipado: el cargo vence el día de corte del período;
- pagos registrados manualmente con comprobante adjunto opcional y pagos parciales;
- prorrateo diario automático cuando un contrato cambia a mitad de período.

## What Changes

- Cargos (`charges` y `charge_lines`) por período y por frecuencia de cada ítem del contrato: mensuales, anuales y únicos. Se calculan desde el fin de la prueba o el inicio, con el día de corte y el ajuste a fin de mes. Toman los precios y el IVA congelados en la versión vigente y nunca se duplican.
- Proceso automático (`ControlCenterBillingWorker`), apagado por defecto, que genera los cargos que vencen dentro de una ventana de anticipación. El SUPER_ADMIN puede forzar la generación de un contrato desde su ficha.
- Prorrateo diario al enmendar un contrato a mitad de período: si sube el valor se genera un cargo proporcional; si baja, un crédito que se aplica a los cargos abiertos del mismo contrato.
- Recaudos (`receipts`) con medio, referencia, fecha, notas y comprobante (PDF o imagen) guardado de forma privada. Se aplican a uno o varios cargos (`receipt_allocations`), con pagos parciales y saldo a favor.
- Anulación de cargos y recaudos, y reverso de aplicaciones, con motivo obligatorio y auditoría.
- Cartera: saldo por cuenta, vencido por tramos (1-30, 31-60, 61-90 y más de 90 días) y próximos vencimientos.
- Web: pestaña **Cartera**, cargos y botón "Generar cargos" en la ficha del contrato, y registro de pagos con su aplicación.

## Capabilities

### New Capabilities

- `control-center-billing`: generación idempotente de cargos por período.
- `control-center-proration`: prorrateo diario por enmiendas.
- `control-center-collections`: recaudos, comprobantes y aplicaciones.
- `control-center-receivables`: cartera, vencimientos y anulaciones.

### Modified Capabilities

- `control-center-contracts`: la enmienda dispara el prorrateo y reemplaza los cargos futuros sin pagos, la terminación anula los cargos posteriores sin pagos y se agrega la anulación de un contrato activo registrado por error. Se especifica en `control-center-proration` y `control-center-billing` porque la spec base de contratos se crea al archivar la fase 1.

## Impact

- Migración `V113__control_center_charges_receipts.sql` y su rollback.
- `api/src/modules/control-center/{billing,collections,receivables}/**` y ajuste en `contracts/contracts.service.ts`.
- `web/domains/control-center/**` y `web/app/[tenant]/control-center/receivables/**`.
- Variables nuevas: `CONTROL_CENTER_BILLING_WORKER_ENABLED`, `CONTROL_CENTER_BILLING_WORKER_INTERVAL_MS`, `CONTROL_CENTER_BILLING_LEAD_DAYS`, `CONTROL_CENTER_RECEIPT_MAX_SIZE_MB`.
- Fuera de alcance: correos, WhatsApp y avisos (fase 3); facturación electrónica de MANUS; pasarelas de pago; suspensión por mora.
