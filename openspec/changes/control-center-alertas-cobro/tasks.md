## 1. Prerrequisitos

- [x] 1.1 Confirmar canales, destinatarios, calendario y proveedor de correo con el propietario.
- [ ] 1.2 Crear la rama desde `develop` actualizado y registrar el ownership en `openspec-scope.json`.

## 2. Base de datos

- [ ] 2.1 Crear `V114__control_center_billing_alerts.sql`: `control_center.billing_alerts` con índice único de idempotencia y `public.tenant_billing_notices` con un aviso activo por cargo; privilegios del rol del Control Center y `SELECT` para los roles operativos existentes.
- [ ] 2.2 Crear el rollback protegido y la prueba de contrato SQL.
- [ ] 2.3 Aplicar en LOCAL y verificar idempotencia, aviso único y escritura restringida.

## 3. API Control Center

- [ ] 3.1 Cálculo puro de etapas (umbrales, etapa vigente y sin ráfaga) con pruebas.
- [ ] 3.2 `ControlCenterAlertsService`: aviso del dashboard (upsert y resolución), correo con reserva y envío fuera de la transacción, reintentos y bloqueo `pg_try_advisory_lock`.
- [ ] 3.3 Correo: configuración SMTP, transporte `nodemailer`, plantilla HTML y texto con escape, y pruebas de plantilla.
- [ ] 3.4 Integrar con el worker de facturación y endpoints `alerts/run`, `alerts/test-email`, `alerts/status`, `charges/:id/remind` y el historial de alertas del cargo.
- [ ] 3.5 Resolver avisos al aplicar pagos y al anular cargos, y estado del correo en readiness.

## 4. API operativa y web

- [ ] 4.1 Módulo `billing-notices` con `GET /billing-notices/active` para administradores del tenant, con pruebas de roles y alcance.
- [ ] 4.2 Banner en el dashboard del tenant cliente (oculto para `USER` y cuando falla la consulta).
- [ ] 4.3 Control Center: alertas en el detalle del cargo, "Enviar recordatorio", "Ejecutar alertas" y correo de prueba en Cartera.

## 5. Verificación

- [ ] 5.1 Pasar `openspec validate control-center-alertas-cobro --strict` y la gobernanza en modo STRICT.
- [ ] 5.2 QA local: aviso previo, vencimiento y mora con fechas simuladas, banner para ADMIN y no para USER, correo de prueba y recordatorio manual, resolución al pagar.
- [ ] 5.3 Documentar la evidencia en `docs/evidencia-control-center-alertas-cobro.md`.
