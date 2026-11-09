## Context

Las fases 0.5, 1 y 2 están fusionadas: contratos, cargos por período, pagos y cartera viven en el esquema `control_center`, al que solo accede el rol dedicado `manus_control_center_app`. La API operativa no tiene permisos sobre ese esquema y readiness verifica ese aislamiento. Los clientes usan MANUS desde su propio tenant y hoy no reciben ningún aviso de cobro.

## Goals / Non-Goals

**Goals:**

- Avisar a tiempo, sin duplicar ni inundar: una vez por etapa y canal.
- Mostrar el aviso a los administradores del tenant cliente dentro de MANUS sin romper el aislamiento del esquema `control_center`.
- Enviar correo con un SMTP configurable y dejar trazabilidad de cada envío.

**Non-Goals:**

- WhatsApp (fase 3b: requiere Meta Business y plantillas aprobadas).
- Suspender o limitar el servicio por mora.
- Facturación electrónica de MANUS a sus clientes.
- Editar las etapas desde la interfaz (quedan como constantes).

## Decisions

### D1. Etapas y regla de envío

Para cada cargo `OPEN` o `PARTIALLY_PAID`, `días = hoy (Bogotá) − vencimiento`:

| Etapa | Desde |
|---|---|
| `UPCOMING` | `días ≥ −5` |
| `DUE` | `días ≥ 0` |
| `OVERDUE_1` | `días ≥ 1` |
| `OVERDUE_7` | `días ≥ 7` |
| `OVERDUE_15` | `días ≥ 15` |
| `OVERDUE_30` | `días ≥ 30` |

La etapa vigente es la de mayor umbral alcanzado. Se envía si no existe registro `SENT` o `SKIPPED` para `(cargo, etapa, canal)`. Las etapas anteriores no enviadas se omiten para no mandar varios correos el mismo día. Después de 30 días no hay más recordatorios automáticos; queda el botón manual. La ventana de 5 días coincide con la anticipación de la facturación, así que el aviso previo sale cuando se genera el cargo.

**Alternativa descartada:** enviar todas las etapas pendientes. Al encender el worker sobre una cartera vieja, mandaría hasta seis correos por cargo.

### D2. Bitácora `control_center.billing_alerts`

Columnas: `id`, `charge_id`, `account_id`, `tenant_id`, `stage`, `channel` (`DASHBOARD`/`EMAIL`), `trigger_source` (`WORKER`/`MANUAL`), `status` (`SENT`/`FAILED`/`SKIPPED`), `recipient`, `attempts`, `last_error`, `created_at`, `sent_at`, `created_by`.

- Índice único parcial `(charge_id, stage, channel) WHERE trigger_source = 'WORKER'`: idempotencia del proceso.
- Los envíos manuales no tienen esa restricción.
- Un `FAILED` se reintenta en las ejecuciones siguientes hasta 3 intentos (actualiza `attempts`, `last_error` y `status`).
- `SKIPPED` registra que la etapa se omitió, por ejemplo porque el canal está apagado o la cuenta no tiene correo válido.
- Sin `DELETE` para el rol. `UPDATE` solo en estado, intentos, error y fecha de envío.

### D3. Avisos del dashboard en `public.tenant_billing_notices`

La API operativa no puede leer `control_center`. El Control Center publica un resumen mínimo en una tabla del esquema `public`:

- **Columnas:** `id`, `tenant_id`, `charge_id`, `charge_number`, `stage`, `due_date`, `balance`, `currency`, `period_start`, `period_end`, `created_at`, `updated_at`, `resolved_at`.
- **Un aviso activo por cargo:** índice único parcial `(charge_id) WHERE resolved_at IS NULL`. El proceso hace upsert con la etapa y el saldo vigentes.
- **Resolución:** el aviso se resuelve (`resolved_at`) cuando el cargo queda `PAID` o `VOID`. Esto ocurre en la misma transacción de la aplicación de pagos y de la anulación del cargo, y también en cada ejecución del proceso como respaldo.
- **Privilegios:**
  - El rol del Control Center tiene `SELECT`, `INSERT` y `UPDATE`.
  - Los roles operativos existentes (`manus_user`, `manus_qa_user`) reciben solo `SELECT`, concedido con un bloque que verifica que el rol exista.
  - Nadie tiene `DELETE`.
- **Contenido:** no incluye nombres de planes ni datos de otras cuentas, solo lo necesario para el aviso.

### D4. Endpoint operativo y banner

- **Módulo operativo `billing-notices`:** `GET /billing-notices/active` con `JwtAuthGuard` y `RolesGuard` para `ADMIN`, `SUPER_USER` y `SUPER_ADMIN`.
  - Lee del `DatabaseService` operativo los avisos con `resolved_at IS NULL` del `tenantId` del token.
  - Un usuario `USER` recibe 403 y el banner no se pide.
- **Banner web en el dashboard del tenant:**
  - Una fila por aviso, ordenada por vencimiento. Tono informativo para `UPCOMING`, de advertencia para `DUE` y de peligro en mora.
  - Texto: "Tienes un pago pendiente con MANUS: cargo X por $Y, vence el D" o "vencido hace N días".
  - Se puede ocultar durante la sesión (`sessionStorage`).
  - Si el endpoint falla, el dashboard sigue funcionando sin banner.

### D5. Correo SMTP

- **Transporte:** `nodemailer` con `CONTROL_CENTER_SMTP_HOST`, `CONTROL_CENTER_SMTP_PORT` (587 por defecto), `CONTROL_CENTER_SMTP_SECURE`, `CONTROL_CENTER_SMTP_USER`, `CONTROL_CENTER_SMTP_PASSWORD` y `CONTROL_CENTER_ALERTS_FROM`.
  - El canal está activo solo con `CONTROL_CENTER_ALERTS_EMAIL_ENABLED=true` y la configuración completa.
  - Si no lo está, las etapas de correo quedan `SKIPPED` con el motivo y el dashboard sigue funcionando.
- **Destinatario:** el `billing_email` de la cuenta comercial.
- **Plantilla en español:**
  - Asunto por etapa, por ejemplo "MANUS: tu pago de $850.000 vence el 08/12/2026" o "MANUS: pago vencido hace 7 días".
  - Cuerpo HTML y de texto con cliente, cargo, período, saldo y vencimiento, más las instrucciones de `CONTROL_CENTER_PAYMENT_INSTRUCTIONS`.
  - Los valores se escapan en HTML.
- **Envío fuera de la transacción:** se reserva el registro `FAILED` con `attempts = 0` dentro de una transacción corta y se envía fuera de ella, para no mantener bloqueos durante la llamada SMTP. Después se marca `SENT` o `FAILED`.
- **Prueba de configuración:** `POST alerts/test-email` (`{ to }`) envía un correo de prueba sin tocar la cartera; la acción queda auditada.
- **Recordatorio manual:** `POST charges/:id/remind` envía el correo de la etapa vigente (o de `DUE` si el cargo aún no vence) y queda en la bitácora con `trigger_source = MANUAL`.
- **Readiness:** informa si el correo está activo y configurado, sin exponer credenciales.

### D6. Proceso automático

- **`ControlCenterAlertsService.runAll(today)`** recorre los cargos con saldo, calcula la etapa, publica o actualiza el aviso del dashboard y envía el correo pendiente. También resuelve los avisos de cargos pagados o anulados.
- **Activación:** con `CONTROL_CENTER_ALERTS_ENABLED=true` corre al final de cada ejecución del worker de facturación (misma frecuencia), después de generar los cargos. Hay un botón "Ejecutar alertas ahora" en Cartera.
- **Concurrencia:** varias instancias son seguras gracias al índice único de la bitácora y al bloqueo consultivo `control-center:alerts`, que se toma con `pg_try_advisory_lock` y se omite si otra instancia lo tiene.

### D7. Auditoría y acciones

Acciones nuevas: `ALERTS_RUN_MANUAL`, `CHARGE_REMINDER_SENT` y `ALERT_TEST_EMAIL_SENT`. Ninguna es crítica. Las alertas automáticas no generan evento de auditoría por cada envío; la bitácora es su registro.

### D8. Web del Control Center

- **Detalle del cargo:** sección "Alertas" con fecha, etapa, canal, estado y destinatario, y botón "Enviar recordatorio".
- **Cartera:** botón "Ejecutar alertas" y, en un panel, el estado del correo y "Enviar correo de prueba".

## Risks / Trade-offs

- **Correo marcado como spam o SMTP caído.** La bitácora conserva el error, se reintenta hasta 3 veces y el aviso del dashboard no depende del correo.
- **Tabla en `public` escrita por el Control Center.** Es solo de avisos y sin datos sensibles, y la escritura queda restringida al rol dedicado. Se evita dar acceso al esquema `control_center` a la API operativa.
- **Roles operativos con otros nombres en algún ambiente.** El bloque de privilegios se adapta a los que existan; el runbook indica cómo conceder `SELECT` si el nombre difiere.
- **Dependencia nueva `nodemailer`.** Es una librería estándar y sin dependencias transitivas. Se fija la versión en `package-lock.json`.

## Migration Plan

V114 es aditiva. Las alertas y el correo se despliegan apagados. En QA se configura el SMTP, se envía el correo de prueba y se activan las alertas; después, en PRD.

**Rollback:** apagar las banderas y aplicar el rollback protegido, que falla si hay datos.

## Open Questions

Ninguna. Confirmado por el propietario: dashboard + correo, solo administradores, calendario 5 días antes / vencimiento / 1, 7, 15 y 30 días, SMTP configurable.
