# Diseno: mejoras-funcionales-operativas-caja-roles-menu

## Objetivo

Unificar la operacion de caja, tickets, contexto POS, navegacion inicial y menu por rol para que el operador tenga un flujo claro:

1. Login entra a dashboard.
2. POS no opera sin caja abierta.
3. Caja se abre con contexto autorizado.
4. Turno muestra informacion asociada a la caja actual.
5. Cierre genera feedback claro y ticket accesible.
6. Menu y rutas reflejan permisos reales por rol.

## Principios

- Mantener tenant-aware en toda consulta y ticket.
- El menu ayuda, pero la API siempre valida.
- No usar bypass global para `USER`.
- Reutilizar patrones existentes: `NoticeDialog`, `PdfPreviewModal`, servicios de reporteria y helpers de descarga.
- Impresion de ticket no es parte critica de la transaccion de cierre.
- Si una fase no queda implementada, documentar pendiente real sin inventar PASS.

## Flujo de cierre de caja

```text
Usuario confirma cierre
  -> API cierra sesion
  -> Web refresca caja actual e historial
  -> NoticeDialog success
       -> resumen operativo
       -> Ver ticket
       -> Descargar PDF
       -> Imprimir

Fallo API
  -> caja sigue abierta en frontend
  -> modal/formulario sigue visible
  -> NoticeDialog error/warning
  -> no imprime
```

Datos visibles si backend los entrega:

- monto apertura,
- entradas,
- salidas,
- esperado,
- real,
- diferencia,
- fecha/hora cierre.

## Ticket de cierre

El frontend debe reutilizar el endpoint existente de reporteria:

`GET /api/reports/cash-closings/:cashSessionId/ticket`

El patron esperado es:

- vista previa PDF con `PdfPreviewModal`,
- descarga con `downloadBlob`,
- impresion mediante ventana/iframe del PDF,
- error visible si el PDF no existe, si el usuario no esta autorizado o si el backend falla.

El backend-reporteria debe permitir `USER` solo en la ruta puntual de ticket si las funciones SQL ya restringen por tenant, sucursal y usuario autorizado.

## Vista `/finance/cash-sessions`

El historial debe diferenciar:

- sesiones cerradas: acciones Ver ticket, Descargar PDF e Imprimir,
- sesiones abiertas/canceladas: accion no disponible o deshabilitada con texto operativo.

No se debe duplicar logica de reporteria si ya existe helper.

## Post-login

Login normal y force-login deben redirigir a:

`/{tenantId}/dashboard`

La recuperacion de deep link por sesion expirada no debe forzar POS como primera vista de login normal.

## POS sin caja abierta

El sistema debe bloquear operacion POS si no hay caja abierta:

- menu muestra POS desactivado o con estado "requiere caja",
- navegacion directa a `/{tenantId}/pos` muestra bloqueo operativo y CTA a `/{tenantId}/pos/select-context`,
- con caja abierta POS queda operativo.

## Seleccion de contexto

`/{tenantId}/pos/select-context` resuelve sucursal y terminal segun rol:

- `USER` y `ADMIN`: sucursal asignada fija, terminales de esa sucursal.
- `SUPER_USER` y `SUPER_ADMIN`: sucursales del tenant autorizado, terminales de la sucursal seleccionada.

Debe bloquear terminal de otro tenant o sucursal.

## Gestion de turno

La gestion de turno debe agrupar datos de la caja abierta actual:

- ventas POS,
- pedidos,
- compras,
- movimientos,
- arqueo,
- tickets.

El alcance minimo es una primera vista funcional con tarjetas/resumen y accesos a movimientos/tickets.

## Permisos y menu

Reglas objetivo:

- `USER`: dashboard, POS sujeto a caja, pedidos si permitido, caja/turno, tickets propios/autorizados.
- `ADMIN`: lo anterior mas compras, productos, unidades, impuestos y proveedores en su contexto.
- `SUPER_USER`: lo anterior mas promociones y alcance tenant.
- `SUPER_ADMIN`: alcance actual del sistema, sin exposicion cross-tenant.

El frontend puede ocultar/desactivar, pero las rutas directas y APIs deben validar roles y alcance.

## Validacion

Checks minimos por fase tocada:

- `openspec.cmd validate mejoras-funcionales-operativas-caja-roles-menu --type change --strict`
- `openspec.cmd validate --strict`
- `npm.cmd run build` en apps modificadas si viable
- tests especificos si existen o se agregan
- QA manual documentado por rol
- `git diff --check`
- `git status --short`
