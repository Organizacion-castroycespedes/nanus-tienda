## Context

`pos_user_sessions` ya es la fuente de verdad para el contexto POS. El módulo existente crea sesiones y expone la sesión actual, pero no ofrece una consulta administrativa por terminal ni una finalización individual. La sesión persistente de TERM-001 debe poder analizarse y cerrarse sin tocar Devices, bindings, cajas, ventas, pagos ni `auth_sessions`.

La operación cruza NestJS, PostgreSQL, auditoría y Configuración de Terminales. El actor administrativo llega por `JwtAuthGuard`, `RolesGuard` y `PermissionsGuard`; el tenant proviene del contexto autenticado y la terminal se resuelve por ID interno, tenant y sucursal.

## Goals / Non-Goals

**Goals:**

- Listar sesiones activas de una terminal concreta con datos operativos mínimos.
- Cerrar una sola sesión mediante endpoint autenticado y auditado.
- Evitar cierre si existe caja abierta, operación pendiente, cambio concurrente o alcance inválido.
- Usar bloqueo de fila dentro de una transacción para resolver carreras.
- Añadir una acción clara en Configuración de Terminales usando `ConfirmProvider` y `ConfirmDialog`.
- Mantener el cierre normal del usuario separado del cierre administrativo.

**Non-Goals:**

- No cerrar cajas ni modificar ventas, pagos, movimientos o `auth_sessions`.
- No cerrar sesiones masivamente ni por usuario global.
- No tocar Devices, bindings, Electron, Peripheral Agent o Installer.
- No añadir timeout, heartbeat ficticio, pairing ni credenciales físicas.
- No crear migraciones si el esquema existente alcanza el contrato.

## Decisions

1. **Extender `pos-user-sessions` en vez de crear otro módulo.** La tabla, repositorio y servicio ya existen. Se agregan métodos administrativos al mismo módulo para conservar una sola fuente de verdad.

2. **Permisos administrativos.** La consulta requiere `SUPER_ADMIN` y `CONFIG_TERMINALS READ`; el cierre requiere `SUPER_ADMIN` y `CONFIG_TERMINALS WRITE`. El tenant efectivo siempre proviene del actor autenticado. La terminal debe pertenecer al tenant y branch solicitados.

3. **Cierre conservador.** El servicio consulta cajas propias y compartidas de la terminal, ventas y pagos asociados a cajas abiertas y otros estados no terminales definidos por el esquema real. Si encuentra actividad, responde `409 Conflict` sin actualizar la sesión. No se infiere seguridad desde timestamps antiguos.

4. **Concurrencia.** El cierre inicia `BEGIN`, bloquea la sesión POS con `SELECT ... FOR UPDATE`, vuelve a verificar que sigue activa y repite las comprobaciones de caja/operaciones dentro de la misma transacción. Después actualiza únicamente `is_active = FALSE` y `ended_at = NOW()`.

5. **Auditoría.** `AuditService.logEvent` registra `POS_SESSION_ADMIN_CLOSED` con tenant, actor, sesión, terminal, branch, motivo y resultado. No se guardan tokens, cookies ni datos innecesarios.

6. **UI contextual.** El panel de terminales carga sesiones de la terminal seleccionada. Cada fila tiene cierre individual. El diálogo muestra código/nombre, usuario, inicio y motivo. Cancelar no llama API. El panel refresca y descarta selección al cambiar terminal.

7. **Errores explícitos.** `404` representa sesión o terminal inexistente; `403` alcance o permiso inválido; `409` caja, operación o carrera; `400` motivo inválido. La UI conserva el mensaje accionable y no reintenta automáticamente.

## Risks / Trade-offs

- [Sesión creada concurrentemente] → El bloqueo de sesión y la relectura dentro de la transacción impiden cerrar una fila distinta; el resultado se valida antes del `COMMIT`.
- [Caja compartida no visible por una relación incompleta] → El backend consulta `cash_registers.terminal_id` y relaciones de `cash_sessions`, no decide por datos del frontend.
- [Cierre administrativo interrumpe una operación legítima] → Requiere motivo y confirmación explícita; se bloquea si hay caja u operación pendiente.
- [Auditoría asíncrona puede fallar] → Se conserva el warning existente y la operación principal no se revierte; la respuesta no declara más de lo que confirmó la transacción.
- [Usuarios antiguos sin permiso] → Reciben rechazo 403; no se agrega bypass por headers ni por `installationId`.

## Migration Plan

No se requiere migración prevista. Desplegar API y Web juntos. Verificar primero listado read-only en QA; probar cierre sobre una sesión controlada; revisar `auditoria_eventos`; después repetir la lectura de TERM-001. Rollback: retirar la UI y endpoints en un despliegue posterior; no se requiere restaurar datos porque el cierre conserva la fila y su historial.

## Open Questions

- Confirmar en pruebas QA los estados exactos de ventas y pagos que el repositorio considera terminales en este esquema.
- Confirmar si el proyecto requiere un formato mínimo de motivo administrativo o basta con longitud y contenido no vacío.
