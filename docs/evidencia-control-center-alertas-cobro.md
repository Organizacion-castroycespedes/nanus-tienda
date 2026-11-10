# Evidencia: MANUS Control Center, fase 3 (alertas de cobro)

OpenSpec: `control-center-alertas-cobro` · Rama: `feature/develop/control-center-alertas-cobro` · Fecha: 2026-11-10

## Alcance

- **Migración** `V114__control_center_billing_alerts.sql` (SHA-256 `ca644fb3deec7249cff9b46bc55b0b925ea34500f341ed6a5f4e193adcb7249c`), con su rollback protegido y su prueba de contrato:
  - `control_center.billing_alerts`: bitácora de alertas.
  - `public.tenant_billing_notices`: avisos del dashboard. La escribe solo el rol del Control Center y la API operativa solo la lee.
- **Calendario por cargo con saldo:**
  - Etapas: 5 días antes, día del vencimiento, y 1, 7, 15 y 30 días de mora.
  - Se envía solo la etapa vigente y una sola vez por canal, sin ráfaga.
  - Hay reintentos de correo, hasta 3.
- **Correo SMTP con `nodemailer` 6.9.16:**
  - Plantilla en español con instrucciones de pago configurables.
  - Correo de prueba y recordatorio manual.
  - Estado del canal en `GET alerts/status`.
- **Ejecución:**
  - Automática después del worker de facturación, con `CONTROL_CENTER_ALERTS_ENABLED`.
  - Manual con **Ejecutar alertas**.
- **API operativa:** `GET /billing-notices/active` para `ADMIN`, `SUPER_USER` y `SUPER_ADMIN`. Devuelve solo los avisos del tenant del token.
- **Web:**
  - Banner en el dashboard del tenant cliente.
  - Panel de alertas en Cartera.
  - Historial de alertas y botón **Enviar recordatorio** en el detalle del cargo.
- **Sincronización de avisos:** se resuelven al pagar o anular un cargo y al anular un contrato. El saldo se actualiza con los abonos.

## Validación automatizada (Windows)

| Verificación | Resultado |
|---|---|
| `openspec validate control-center-alertas-cobro --strict` | Válido |
| Gobernanza STRICT con los archivos cambiados frente a `develop` | `REPOSITORY_GATE_STATUS=PASS`, `STRICT_PASS` |
| API `tsc --noEmit` | OK |
| API: pruebas de `control-center`, `billing-notices` y guards | 157/157 |
| API: suite completa | 1080 pasan, 2 omitidas, 0 fallas |
| Web: pruebas de `format`, `access` y `notices` | 14/14 |
| Web: lint | Sin advertencias ni errores |
| Web `tsc --noEmit` | 26 errores preexistentes en `*.spec.ts` ajenos; 0 fuera de specs |
| Contrato SQL V111–V114 | 33 pruebas OK (4 omitidas sin bash en Windows; se ejecutan en CI) |

## Reglas verificadas en PostgreSQL 16 real (rol dedicado y `manus_user`)

**17/17 correctas:**

- Un solo registro automático por cargo, etapa y canal (`uq_cc_ba_worker`). Los envíos manuales se pueden repetir.
- La etapa de la bitácora no se puede cambiar. `SENT` exige fecha de envío. Sin `DELETE`.
- Un solo aviso activo por cargo (`uq_tbn_active_charge`), que se actualiza con upsert. Un aviso resuelto es definitivo y después se puede crear uno nuevo.
- `manus_user` lee los avisos y no puede escribirlos ni acceder a `control_center`.
- V114 se puede reaplicar. El rollback se niega a borrar datos.

## Integración de servicios contra PostgreSQL real (SMTP simulado)

- 03/11: aviso previo "MANUS: tu pago de $850.000 vence el 08/11/2026". Una segunda ejecución el mismo día no duplica nada.
- 17/11, después de 10 días sin correr: solo se envía `OVERDUE_7`, sin las etapas anteriores en ráfaga. Una cuenta sin correo válido queda `SKIPPED`.
- La API operativa, con `manus_user`, ve solo los avisos de su tenant. Otro tenant no ve nada.
- Con el SMTP caído: `FAILED` con 3 intentos y sin credenciales en el error.
- Un abono actualiza el saldo del aviso. El pago total lo resuelve en la misma transacción. Un recordatorio de un cargo pagado responde 409.
- Si se anula el pago, el aviso reaparece en `OVERDUE_30`. Después de 30 días no hay más correos automáticos.
- Se probaron el recordatorio manual repetible, el correo de prueba (enviado, dirección inválida y SMTP caído) y la anulación de contrato, que resuelve sus avisos.

## QA operativa del propietario (base local `manus_prd_local_test`)

V114 se aplicó directamente sobre la base local, con el mismo criterio que V111 a V113. `nodemailer` 6.9.16 quedó instalado en `api`.

**Correo (Brevo, plan gratuito):**

- El primer intento falló con `535 Authentication failed`. La causa fue el usuario SMTP copiado con la etiqueta "Inicio de sesión" y con signos `< >`. Se corrigió en `api/.env`.
- El correo de prueba llegó a Hotmail, en la carpeta de correo no deseado. El remitente aparece como `…@brevosend.com` porque el remitente es una dirección `@gmail.com` sin dominio propio autenticado.

**Alertas:**

- `MCC-COB-2026-000002`: prorrateo de $349.041 que vencía el 09/11.
  - Aviso del dashboard en `OVERDUE_1`.
  - Correo `FAILED` (intento 1 de 3) por la credencial errada.
  - Al registrar el pago `MCC-REC-2026-000005`, el aviso quedó resuelto.
- `MCC-COB-2026-000003`: nueva terminal desde el 10/11, $348.082 = 363/365 × $350.000.
  - **Ejecutar alertas** publicó el aviso `DUE` y envió el correo automático "vence hoy" (`SENT`).
  - **Enviar recordatorio** envió el correo manual (`SENT`).
  - El cargo queda pendiente, con su aviso activo.
- El propietario revisó el banner en el dashboard del tenant cliente con usuarios ADMIN y USER.
- La auditoría registró las ejecuciones manuales (`ALERTS_RUN_MANUAL`), los correos de prueba (`ALERT_TEST_EMAIL_SENT`) y el recordatorio (`CHARGE_REMINDER_SENT`).

## Pendiente para QA y PRD

- Aplicar V114 con el runner oficial en `manus_tienda_qa`, después de V111 a V113.
- Confirmar que el usuario runtime de la API operativa del ambiente lee `public.tenant_billing_notices`. El runbook explica cómo concederlo si el nombre difiere.
- Autenticar en Brevo un dominio propio (DKIM/SPF) para que los correos no lleguen a spam y muestren el remitente de MANUS.
- Configurar `CONTROL_CENTER_SMTP_*`, `CONTROL_CENTER_ALERTS_FROM` y `CONTROL_CENTER_PAYMENT_INSTRUCTIONS`. Enviar el correo de prueba y activar `CONTROL_CENTER_ALERTS_ENABLED` junto con el worker de facturación.
- Fase 3b: WhatsApp, con el teléfono E.164 y el consentimiento ya registrados en la cuenta comercial.
