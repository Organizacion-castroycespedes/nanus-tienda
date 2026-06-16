## Context

El modulo Promociones ya implementa reglas de negocio, payloads y validaciones de formulario. El problema es de UX: crear/editar vive en `Modal`, mientras el estandar nuevo de catalogos usa `FocusActionLayout`.

Promociones no tiene eliminacion ni activacion en el servicio actual; existe `deactivatePromotion`. Por eso el alcance cubre crear, editar y desactivar.

## Goals / Non-Goals

**Goals:**

- Reutilizar `FocusActionLayout`.
- Extraer el contenido del modal a un componente de formulario renderizado en pagina.
- Mantener crear/editar/desactivar como acciones enfocadas.
- Ocultar listado/filtros durante accion activa.
- Mantener cancelar/regresar sin limpiar filtros ni listado innecesariamente.
- Usar `ConfirmDialog` solo para success post accion.
- Mantener errores con `Toast` o error inline actual.

**Non-Goals:**

- No cambiar contratos API.
- No cambiar permisos, guards ni RBAC.
- No agregar SQL ni migraciones.
- No implementar activar/eliminar si el modulo no lo soporta hoy.
- No redisenar tabla, filtros ni reglas de promociones.

## Decisions

- Crear `PromotionFormPanel`.
  - Rationale: el contenido del modal era largo y conviene aislarlo sin duplicar logica de payload ni validacion.

- Mantener estado de formulario y handlers en la pagina.
  - Rationale: evita tocar contratos y mantiene la logica actual de `createPromotion`, `updatePromotion` y `deactivatePromotion`.

- Reemplazar confirmacion de desactivar por panel enfocado.
  - Rationale: desactivar es una accion operativa y debe quedar dentro del foco visual, no como modal.

- Usar `ConfirmDialog` para success post accion.
  - Rationale: el patron de catalogos exige feedback visual con `hideCancel`, `Entendido` y `variant="success"`.

## Risks / Trade-offs

- [Risk] El formulario de promociones es largo en mobile -> Mitigation: `FocusActionLayout` mantiene controles de regresar/cancelar arriba y el formulario conserva grids responsivos.
- [Risk] Sacar el modal podria alterar payloads -> Mitigation: se conserva `buildPayload`, `validateForm` y handlers actuales.
- [Risk] Desactivar ya no usa dialogo modal -> Mitigation: se muestra panel destructivo enfocado con cancelar y confirmar.
