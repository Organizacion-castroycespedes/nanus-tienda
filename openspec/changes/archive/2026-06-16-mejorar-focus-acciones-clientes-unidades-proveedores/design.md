## Context

Pedidos y Compras ya reducen el ruido visual cuando hay una accion activa. Clientes, Unidades, Proveedores e Impuestos todavia renderizan formulario, filtros y tabla al mismo tiempo, lo que mezcla el flujo de captura con el listado.

Las vistas objetivo ya usan estado local `formMode` y formularios existentes. No se requiere cambio API, SQL, permisos ni backend.

Nombre conceptual consolidado: **Focus UX para acciones de catalogo**.

## Goals / Non-Goals

**Goals:**

- Reutilizar el patron `FocusActionLayout` para enfocar crear/editar.
- Mantener acciones destructivas dentro del foco cuando el modulo ya permite eliminar.
- Ocultar filtros, listados y acciones secundarias mientras hay formulario activo.
- Mantener volver/cancelar al listado con filtros y paginacion en memoria.
- Agregar confirmacion visual post crear/editar con `ConfirmDialog`.
- Mantener errores con el manejo actual de cada modulo.
- Dejar guia reusable para futuros modulos tipo catalogo.

**Non-Goals:**

- No cambiar contratos API.
- No cambiar permisos, guards ni RBAC.
- No agregar SQL ni migraciones.
- No redisenar tablas, filtros o formularios.

## Decisions

- Reutilizar `FocusActionLayout`.
  - Rationale: ya existe en `web/modules/inventory/components` y expresa el patron de accion activa sin crear otro layout.
  - Alternativa descartada: duplicar headers locales en cada pagina.

- Usar `ConfirmDialog` para exito de crear/editar.
  - Rationale: el requerimiento pide confirmacion visual con `ConfirmDialog`, `hideCancel` y boton `Entendido`.
  - Se agrega variante `success` al componente existente para representar exito sin crear un componente nuevo.

- Mantener estado local de filtros/listado.
  - Rationale: ocultar el listado no debe borrar filtros, pagina ni resultados ya cargados; al cancelar o guardar se vuelve al mismo contexto visual.

- Documentar el patron en `docs/frontend/catalog-action-focus-ux.md`.
  - Rationale: el comportamiento debe quedar como estandar reusable para Categorias, Marcas, Bodegas, Metodos de pago y catalogos similares.

- Registrar evidencia tecnica en `docs/evidencia-qa-focus-ux-catalogos.md`.
  - Rationale: el cambio tiene PASS tecnico, pero QA visual manual sigue pendiente; la evidencia debe decirlo sin inventar PASS.

## Risks / Trade-offs

- [Risk] Un formulario largo puede ocupar mucha pantalla en mobile -> Mitigation: `FocusActionLayout` usa ancho responsivo y mantiene controles de volver/cancelar visibles arriba.
- [Risk] ConfirmDialog podria interrumpir flujos rapidos -> Mitigation: solo se dispara en guardar exitoso de crear/editar y se cierra con `Entendido`.
- [Risk] Toasts previos se duplican con dialogos -> Mitigation: crear/editar cambia a ConfirmDialog; errores y eliminaciones conservan el patron actual.
