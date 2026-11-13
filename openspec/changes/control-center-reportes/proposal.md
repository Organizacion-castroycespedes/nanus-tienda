## Why

El Control Center ya registra contratos, cargos, pagos y alertas, pero el propietario no tiene reportes para tres tareas de cada mes: mandarle a un cliente su estado de cuenta, cuadrar lo facturado con lo que entró al banco y anticiparse a las renovaciones antes de perder clientes.

Decisiones del propietario (2026-11-10):

- estado de cuenta en PDF con rango de fechas, que se puede descargar y enviar por correo;
- reporte mensual de facturado frente a recaudado, exportable a Excel (.xlsx);
- renovaciones y pruebas por vencer en ventanas de 30, 60 y 90 días, solo en pantalla.

## What Changes

- **Estado de cuenta por cuenta comercial (PDF).** Para un rango de fechas (por defecto, los últimos 12 meses) muestra:
  - cargos del período y todos los que siguen pendientes, con días de mora;
  - pagos y créditos del período, con lo aplicado y el saldo a favor;
  - totales de facturado, pagado, pendiente y vencido, e instrucciones de pago.

  Se descarga o se envía como adjunto al correo de facturación por el SMTP configurado. Las dos acciones quedan auditadas.
- **Reporte facturado frente a recaudado por mes.** Para un rango de hasta 24 meses:
  - lo facturado por mes de vencimiento;
  - lo recaudado por mes de pago y por medio de pago;
  - los créditos de prorrateo y la diferencia del mes.

  Se ve en pantalla y se exporta a Excel con las hojas *Resumen mensual*, *Cargos* y *Pagos*, usando `exceljs`, que la API ya tiene.
- **Reporte de renovaciones y pruebas por vencer** (30, 60 o 90 días):
  - pruebas que terminan;
  - fin del término inicial;
  - próximas renovaciones anuales.

  Incluye días restantes, valor actual y valor de renovación según el catálogo vigente, con un enlace a la ficha para renovar.
- **Web:** nueva pestaña **Reportes** del Control Center. Botón **Estado de cuenta** en las cuentas y en la Cartera por cuenta.

## Capabilities

### New Capabilities

- `control-center-account-statement`: estado de cuenta en PDF con descarga y envío por correo.
- `control-center-billing-collections-report`: facturado frente a recaudado por mes, con exportación a Excel.
- `control-center-renewals-report`: pruebas, términos iniciales y renovaciones anuales por vencer.

### Modified Capabilities

- `control-center-email-alerts`: el envío de correo admite adjuntos para el estado de cuenta.

## Impact

- **API:**
  - `api/src/modules/control-center/reports/**`, nuevo;
  - ajustes en `alerts/email-sender.ts` (adjuntos), en `contracts/contract-pdf.ts` (encabezado del emisor compartido) y en el módulo.
- **Web:** `web/domains/control-center/**` y la ruta `web/app/[tenant]/control-center/reports/**`.
- **Base de datos:** sin migraciones. Solo lee tablas a las que el rol del Control Center ya tiene acceso.
