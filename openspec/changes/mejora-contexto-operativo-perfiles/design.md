## Context

La plataforma ya tiene JWT, roles, permisos de menu y scopes por tenant/sucursal, pero el flujo operativo no queda armado desde el login. POS puede abrirse por URL directa y varios endpoints dependen de permisos o scopes que no reflejan la operacion real de `USER`, `ADMIN` y `SUPER_USER`.

El cambio cruza frontend, backend y permisos de base. Por eso la decision principal es tratar el contexto operativo como contrato backend-validado, no como estado de UI. El frontend mejora el flujo y oculta acciones, pero el backend conserva la autoridad para tenant, sucursal, terminal y sesion de caja.

## Goals / Non-Goals

**Goals:**

- Resolver el contexto operativo post-login por rol.
- Exigir contexto valido para POS y modulos que operan con sucursal, terminal o caja.
- Validar scopes de tenant, sucursal, terminal y sesion POS/caja en backend.
- Alinear permisos reales para `USER`, `ADMIN` y `SUPER_USER`.
- Corregir menu/rutas frontend para que no muestren acciones no permitidas.
- Agregar pruebas y evidencia QA.

**Non-Goals:**

- No tocar produccion ni ejecutar scripts contra produccion.
- No redisenar todo RBAC.
- No convertir `SUPER_USER` en administrador global.
- No relajar permisos globales para evitar `403`.
- No tocar `backend-reporteria` salvo que una dependencia directa lo exija.
- No hacer refactor masivo de rutas, modulos o base de datos.

## Decisions

1. Backend como fuente de verdad del contexto.

   El frontend puede guardar el contexto operativo para UX, pero cada endpoint sensible validara que `branchId`, `terminalId` y `x-pos-session-id` pertenecen al tenant y al alcance del usuario.

   Alternativa rechazada: confiar en `localStorage` o en checks de menu. Eso no protege URL directas ni payloads manipulados.

2. Scopes por rol con reglas simples.

   `SUPER_ADMIN` conserva alcance global. `SUPER_USER` opera dentro de su tenant. `ADMIN` y `USER` operan dentro de sucursales asignadas. Las terminales siempre se derivan de la sucursal efectiva.

   Alternativa rechazada: crear excepciones por pantalla. Eso duplica permisos y mantiene brechas entre frontend y backend.

3. Selector controlado de contexto.

   Post-login enviara al usuario a contexto operativo cuando falte sucursal o terminal. `/pos` exigira contexto completo. `/pos/select-context` exigira sesion autenticada y opciones filtradas por backend.

   Alternativa rechazada: mantener `/pos/select-context` como entrada manual independiente.

4. Permisos funcionales separados de permisos globales.

   Se habilitan acciones operativas (`orders.create`, `customers.update`, `cash_sessions.close`, inventario operativo) sin otorgar administracion global. Para roles, `SUPER_USER` podra listar roles asignables, no administrar roles globales.

   Alternativa rechazada: dar `roles` completo a `SUPER_USER`, porque abre control de roles superiores.

5. SQL idempotente solo si el repositorio lo necesita.

   Si los `403` vienen de configuracion DB, se agregara script en `scripts/database/security/` con upserts seguros. No se eliminaran permisos existentes sin evidencia y no se ejecutara en produccion.

## Risks / Trade-offs

- [Risk] La estructura real de permisos puede usar menu/actions en vez de codigos planos. Mitigacion: reutilizar nombres y tablas existentes; no inventar permisos si hay convencion local.
- [Risk] Algunos endpoints pueden no tener tests de integracion. Mitigacion: agregar tests unitarios/focalizados donde sea viable y documentar QA manual donde no exista infraestructura.
- [Risk] Cambios de menu pueden ocultar rutas aun si backend permite endpoints historicos. Mitigacion: validar rutas directas y mantener backend como control final.
- [Risk] Contexto operativo persistido puede quedar obsoleto si cambian asignaciones. Mitigacion: revalidar en backend y forzar reseleccion si branch/terminal deja de estar permitido.

## Migration Plan

1. Crear OpenSpec y validar.
2. Inspeccionar permisos actuales, rutas frontend y endpoints backend afectados.
3. Implementar helpers backend de scope/contexto donde ya existan patrones.
4. Ajustar permisos de endpoints y acciones por rol.
5. Ajustar menu/rutas/acciones frontend.
6. Crear SQL idempotente si faltan permisos configurados.
7. Agregar tests backend y evidencia QA.
8. Ejecutar validaciones obligatorias.

Rollback: revertir cambios de codigo y no aplicar el SQL de seguridad. Si el SQL ya fue aplicado en ambiente no productivo, restaurar permisos desde backup o ejecutar script manual de reversa revisado.

## Open Questions

- Confirmar nombres reales de tablas de terminales, sesiones POS y asignaciones usuario-sucursal durante implementacion.
- Confirmar si existe endpoint dedicado para contexto operativo o si conviene agregar uno.
- Confirmar si `GET /api/roles` debe filtrar para `SUPER_USER` o si se crea `GET /api/roles/assignable`.
