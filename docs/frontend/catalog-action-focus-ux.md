# Patron UX: acciones enfocadas en modulos de catalogo

## Proposito

Los modulos de catalogo deben evitar que formularios, listados, filtros y acciones compitan visualmente en la misma pantalla.

El objetivo es:

- Reducir perdida de foco.
- Mejorar operacion en mobile.
- Evitar acciones accidentales.
- Mantener una experiencia consistente entre modulos.
- Reutilizar componentes del design-system.

## Cuando usarlo

Debe usarse en modulos tipo catalogo o administracion cuando existan acciones como:

- Crear.
- Editar.
- Eliminar.
- Ver detalle operativo.
- Cancelar accion.
- Guardar accion.

Ejemplos actuales:

- Clientes.
- Unidades.
- Proveedores.
- Impuestos.
- Promociones.

Debe aplicarse tambien a futuros modulos similares:

- Categorias.
- Marcas.
- Bodegas.
- Metodos de pago.
- Cualquier catalogo administrativo u operativo similar.

## Componentes esperados

- `FocusActionLayout`
- `ConfirmDialog`

## Regla UX principal

Cuando hay accion activa:

- Mostrar solo la accion activa o el contenedor enfocado.
- Ocultar listado, filtros y contenido secundario.
- Mostrar accion clara para volver o cancelar.
- No limpiar estado innecesariamente al cancelar.
- No mezclar formulario con listado en mobile.

Cuando no hay accion activa:

- Mostrar listado.
- Mostrar filtros.
- Mostrar acciones principales.
- No mostrar formularios residuales.

## Confirmacion visual post guardado

Todo crear o editar exitoso debe mostrar `ConfirmDialog` con:

- `variant="success"`
- `confirmText="Entendido"`
- `hideCancel`

Estado recomendado:

```tsx
type ActionFeedback = {
  title: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
};

const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
```

Uso recomendado:

```tsx
<ConfirmDialog
  open={Boolean(actionFeedback)}
  onOpenChange={(open) => {
    if (!open) {
      setActionFeedback(null);
    }
  }}
  title={actionFeedback?.title ?? ""}
  description={actionFeedback?.description}
  confirmText="Entendido"
  variant={actionFeedback?.variant ?? "success"}
  hideCancel
  onConfirm={() => setActionFeedback(null)}
/>
```

Mensajes actuales:

- Cliente creado correctamente.
- Cliente actualizado correctamente.
- Unidad creada correctamente.
- Unidad actualizada correctamente.
- Proveedor creado correctamente.
- Proveedor actualizado correctamente.
- Impuesto creado correctamente.
- Impuesto actualizado correctamente.
- Promocion creada correctamente.
- Promocion actualizada correctamente.
- Promocion desactivada correctamente.

## Flujo recomendado

Crear:

1. Usuario presiona crear.
2. Se activa modo accion.
3. `FocusActionLayout` muestra formulario enfocado.
4. Listado y filtros se ocultan.
5. Usuario guarda.
6. Se muestra `ConfirmDialog` success.
7. Al cerrar confirmacion, listado queda usable.

Editar:

1. Usuario presiona editar.
2. Se activa modo accion con datos cargados.
3. Formulario queda enfocado.
4. Usuario guarda.
5. Se muestra `ConfirmDialog` success.
6. Se mantiene consistencia visual.

Cancelar:

1. Usuario presiona cancelar o volver.
2. Se desactiva accion activa.
3. Se vuelve al listado y filtros.
4. No se debe limpiar data global innecesariamente.

Eliminar:

1. Si el modulo permite eliminar, la confirmacion o accion destructiva debe quedar dentro del foco visual.
2. No mezclar confirmacion destructiva con listado o filtros si ya hay patron de foco.
3. Mantener manejo actual de confirmacion destructiva del modulo.

## Reglas de errores

- No usar `ConfirmDialog` success para errores.
- Los errores deben mantenerse en el patron actual del formulario o modulo.
- No ocultar mensajes de error relevantes.
- No cerrar el formulario automaticamente si la operacion falla.

## Reglas de implementacion

- No duplicar componentes si `FocusActionLayout` y `ConfirmDialog` ya existen.
- No crear un nuevo modal de exito.
- No cambiar contratos de API.
- No tocar backend salvo que sea estrictamente requerido.
- No cambiar permisos ni guards.
- No hacer SQL para esta mejora UX.
- Validar mobile y desktop.
- Mantener nombres de mensajes claros y especificos del modulo.

## Checklist para nuevos modulos

- [ ] Identificar acciones: crear, editar, eliminar, cancelar, guardar.
- [ ] Agregar estado de accion activa.
- [ ] Envolver accion activa con `FocusActionLayout`.
- [ ] Ocultar listado y filtros durante accion activa.
- [ ] Restaurar listado y filtros al cancelar o terminar accion.
- [ ] Agregar `ConfirmDialog` success post crear.
- [ ] Agregar `ConfirmDialog` success post editar.
- [ ] Mantener manejo de errores actual.
- [ ] Validar desktop.
- [ ] Validar mobile.
- [ ] Ejecutar build.
- [ ] Actualizar OpenSpec.
- [ ] Documentar evidencia QA.

## Validacion tecnica minima

```bash
openspec.cmd validate <change-name> --type change --strict
openspec.cmd validate --all --strict
cd web && npm.cmd run build
git diff --check
git status --short
```

## QA manual minima

- Abrir modulo.
- Crear registro.
- Confirmar foco UX.
- Guardar.
- Confirmar dialogo success.
- Cerrar dialogo.
- Confirmar listado usable.
- Editar registro.
- Confirmar foco UX.
- Guardar.
- Confirmar dialogo success.
- Cancelar creacion o edicion.
- Confirmar retorno limpio al listado.
- Validar mobile.
