## Context

El repo tiene frontend Next.js en `web/` con rutas tenant bajo `web/app/[tenant]/...`. Las pantallas operativas actuales usan componentes de `web/components/design-system`, servicios con `apiClient` de `web/lib/http.ts`, permisos con `hasPermission` y `MENU_KEYS`, y menu sidebar cargado desde `/me/menu`.

El backend de Domicilios ya expone `GET /api/deliveries`, `POST /api/deliveries`, `GET /api/deliveries/:id`, `PATCH /api/deliveries/:id` y acciones de estado. La lista backend devuelve `data` y `pagination`, y soporta filtros `status`, `branch_id`, `customer_id`, `order_id`, `sale_id`, `date_from`, `date_to`, `page` y `limit`. No hay busqueda textual backend.

## Goals / Non-Goals

**Goals:**
- Implementar una pantalla inicial usable para ver domicilios, aplicar filtros soportados, abrir detalle, crear domicilio manual basico y ejecutar acciones permitidas.
- Respetar tenant routing y permisos frontend existentes.
- Mantener responsive movil sin overflow global.
- Mostrar errores backend, estados vacios y loading claros.
- Documentar pendientes cuando el backend no entregue historial, nombre de repartidor o busqueda textual.

**Non-Goals:**
- No tocar caja ni crear movimientos financieros.
- No modificar POS ni flujos de ventas/pedidos.
- No modificar facturacion electronica.
- No modificar backend, SQL, seeds ni permisos backend.
- No implementar reportes de domicilios en esta fase.

## Decisions

1. **Modulo frontend aislado en `web/modules/deliveries`**
   - Se agregan tipos, servicio y helpers propios para no mezclar reglas de Domicilios con inventario, pedidos o finanzas.
   - Alternativa descartada: meter la pantalla en `orders`. Eso limita domicilios asociados a ventas o manuales.

2. **Servicio con `apiClient` existente**
   - Se reutiliza `web/lib/http.ts` para token, refresh y headers.
   - Alternativa descartada: crear cliente HTTP nuevo. Seria duplicacion y riesgo de auth distinto.

3. **Filtros backend reales y busqueda local documentada**
   - `status`, `order_id`, `sale_id`, fechas, pagina y limite viajan al backend.
   - La busqueda por contacto/telefono/direccion se aplica localmente sobre la pagina cargada y queda documentada como pendiente backend.
   - Alternativa descartada: enviar un query no soportado al backend.

4. **Acciones por estado en helpers testeables**
   - La matriz de acciones se implementa en helpers puros para probar `CREATED`, `ASSIGNED`, `DISPATCHED` y estados finales.
   - Alternativa descartada: condicionales dispersos en JSX.

5. **Detalle en panel lateral/modal simple**
   - El detalle carga `GET /deliveries/:id` y se muestra en un panel responsive.
   - Historial queda como pendiente si backend no lo devuelve.

6. **Menu backend-driven con ruta protegida**
   - Se agrega `MENU_KEYS.DELIVERIES` y route guard frontend para `/{tenant}/deliveries`.
   - La entrada visible del sidebar depende de `/me/menu`; si el backend/seed no envia `DELIVERIES`, la ruta existe pero no aparecera en menu.

7. **Fase 7C usa integracion visual contextual**
   - Pedidos agrega una accion `Domicilio` en el listado existente y abre un panel contextual. No modifica crear, entregar, facturar, abonar ni cancelar pedidos.
   - Ventas usa la vista de reporteria de ventas POS como vista de venta disponible en el frontend actual; solo agrega consulta/creacion de domicilio por `sale_id`. No toca `web/modules/pos`, no cambia totales, impuestos, caja ni facturacion.
   - El componente de relacion vive en `web/modules/deliveries` para compartir permisos, errores, creacion y navegacion filtrada entre pedidos y ventas.
   - La navegacion al modulo usa query params reales: `order_id` y `sale_id`, que inicializan los filtros de Domicilios.

## Risks / Trade-offs

- [Risk] Busqueda textual no es global porque backend no la soporta. -> Mitigacion: aplicar busqueda local sobre resultados cargados y documentar pendiente.
- [Risk] Asignar requiere un usuario/repartidor y no existe selector de usuarios dedicado. -> Mitigacion: usar input UUID controlado para `assigned_courier_id`.
- [Risk] El backend no devuelve historial ni nombre de repartidor. -> Mitigacion: mostrar IDs/campos disponibles y documentar pendiente.
- [Risk] Menu puede no mostrar Domicilios si la DB no trae item visible. -> Mitigacion: no tocar SQL; documentar seed/menu pendiente.
- [Risk] No existe ruta dedicada `/{tenant}/sales`; la vista de ventas disponible es reporteria POS. -> Mitigacion: integrar solo la tabla de reporteria de ventas y documentar que el flujo POS queda intacto.
- [Risk] Backend puede devolver 404 cuando no existe domicilio relacionado. -> Mitigacion: tratarlo como estado vacio controlado y permitir crear si hay permiso.
- [Risk] Crear domicilio desde venta acepta fuente financiera, pero no debe modificar totales. -> Mitigacion: enviar solo `INVOICE_INCLUDED` o `NO_FEE` como dato de domicilio y mostrarlo como informacion.

## Migration Plan

No hay migracion de datos. Rollback: revertir cambios de `web/modules/deliveries`, ruta tenant, ajustes de `MENU_KEYS`/route guard y documento QA.

## Open Questions

- Cual sera la fuente de repartidores para reemplazar el input UUID?
- El backend agregara busqueda textual global?
- El backend devolvera historial de `delivery_status_history` en detalle?
- El menu `DELIVERIES` se sembrara visible en una fase posterior?
- Habra una ruta operativa dedicada de ventas distinta a reporteria POS para ubicar esta relacion en una fase posterior?
- QA manual visual completo queda pendiente post-merge a `develop`, con usuario real, backend local y datos disponibles.
