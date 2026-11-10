## Why

La fase 2 genera cargos y registra pagos, pero el cliente no se entera de que tiene un pago próximo o vencido, y MANUS tiene que avisar a mano. El propietario definió que en este alcance la mora solo genera alertas, sin suspender el servicio.

Decisiones del propietario (2026-11-09):

- canales: aviso en el dashboard de MANUS del cliente y correo al email de facturación de la cuenta; WhatsApp queda para una fase posterior;
- el aviso del dashboard solo lo ven los administradores del tenant cliente;
- calendario: 5 días antes, el día del vencimiento y a 1, 7, 15 y 30 días de mora;
- correo por SMTP configurable (Brevo gratis u otro servidor), sin cambiar código.

## What Changes

- Calendario de recordatorios por cargo con saldo: `UPCOMING` (desde 5 días antes), `DUE` (día del vencimiento) y `OVERDUE_1`, `OVERDUE_7`, `OVERDUE_15` y `OVERDUE_30`. Se envía solo la etapa más reciente alcanzada y cada etapa una sola vez por canal; si el proceso no corre un día, no se envían las etapas atrasadas en ráfaga.
- Proceso automático de alertas, apagado por defecto, que corre después de la generación de cargos. Bitácora `control_center.billing_alerts` por cargo, etapa y canal, con reintentos de correo fallido.
- Aviso en el dashboard: tabla `public.tenant_billing_notices`, escrita solo por el rol del Control Center y leída por la API operativa. Un aviso activo por cargo, que se actualiza con la etapa y se resuelve cuando el cargo se paga o se anula.
- API operativa: endpoint para que los administradores (`ADMIN`, `SUPER_USER`, `SUPER_ADMIN`) del tenant consulten sus avisos activos. Web: banner en el dashboard del tenant cliente.
- Correo por SMTP (`nodemailer`) con plantilla en español: cargo, período, saldo, vencimiento e instrucciones de pago configurables. Botones en el Control Center para probar la configuración y enviar un recordatorio manual.
- Control Center: historial de alertas en el detalle del cargo y estado del canal de correo en readiness.

## Capabilities

### New Capabilities

- `control-center-alert-schedule`: etapas del calendario, idempotencia por cargo, etapa y canal, y proceso automático.
- `control-center-dashboard-notices`: avisos de cobro en el dashboard del tenant cliente.
- `control-center-email-alerts`: envío por SMTP, plantilla, reintentos, prueba y recordatorio manual.

### Modified Capabilities

- `control-center-collections`: al pagar o anular un cargo se resuelve su aviso del dashboard.

## Impact

- Migración `V114__control_center_billing_alerts.sql` y su rollback.
- `api/src/modules/control-center/alerts/**`, ajustes en `collections/allocations.ts`, `billing/charges.service.ts`, readiness y el módulo.
- Módulo operativo nuevo `api/src/modules/billing-notices/**` y registro en `app.module.ts`.
- Dependencia `nodemailer` en `api/package.json` y `api/package-lock.json`.
- `web/domains/billing-notices/**` y el dashboard del tenant (`web/app/[tenant]/dashboard/page.tsx`).
- Variables nuevas: `CONTROL_CENTER_ALERTS_ENABLED`, `CONTROL_CENTER_ALERTS_EMAIL_ENABLED`, `CONTROL_CENTER_SMTP_*`, `CONTROL_CENTER_ALERTS_FROM`, `CONTROL_CENTER_PAYMENT_INSTRUCTIONS`.
