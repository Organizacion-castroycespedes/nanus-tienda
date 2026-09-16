# Límites de recuperación y sesión del POS

## Recuperación de una venta ambigua

Electron sigue siendo un shell del frontend web. No existe una base transaccional local ni se ofrece venta offline.

El contrato ahora acepta `Idempotency-Key` en `POST /sales` y expone
`GET /sales/idempotency/:key`. La clave se reserva por
`(tenant_id, idempotency_key)` dentro de la misma transacción que crea la
venta. También se guarda un hash del request y del contexto POS confiable.

- Una repetición con la misma clave y el mismo request devuelve la venta original.
- Una repetición con otro request responde `409 Conflict`.
- La clave no puede cruzar tenants: el tenant viene del JWT/contexto y la tabla
  usa una FK compuesta `(tenant_id, sale_id)`.
- Una reserva sin `sale_id` nunca se reintenta automáticamente; responde que
  requiere reconciliación.

El cliente mantiene además una protección local y conservadora:

- el carrito continúa aislado por tenant, sucursal, terminal, usuario y sesión POS;
- antes del POST se persiste un identificador local del intento y el estado `SUBMITTING`;
- si la aplicación reinicia durante ese estado, se recupera como `UNKNOWN`;
- una respuesta HTTP 4xx habilita la corrección y el reintento porque el servidor rechazó la solicitud;
- una caída de red o respuesta 5xx conserva el carrito y bloquea el reintento automático;
- el operador debe revisar las ventas registradas y habilitar manualmente otro intento.

La clave enviada por el POS es el `attemptId` persistido en el carrito. Esto
permite recuperar una respuesta perdida sin inventar una venta offline ni hacer
reintentos automáticos.

## Tenant negativo en endpoints existentes (POS-P2-002)

Regla aplicada: `tenant_id` confiable sale del JWT validado por `JwtAuthGuard`
y, para POS, del contexto de sesión POS que el guard resuelve contra ese mismo
tenant. Body, query string y headers del cliente no pueden reemplazarlo.

| Familia existente | Entrada negativa | Fuente efectiva | Resultado esperado | Evidencia |
| --- | --- | --- | --- | --- |
| `POST /sales`, `GET /sales`, `GET /sales/:id`, cancelación y billing | `body.tenantId`, `body.branchId`, `?branchId`, `x-tenant-id` | JWT + contexto POS | Ignorar campos no confiables; aplicar tenant/sucursal autenticados | `sale.controller.spec.ts`, `sale.service.spec.ts` |
| `GET/POST/PUT /branches` | `?tenantId` o `body.tenantId` de otro tenant | JWT + `BranchesService.resolveTenantId` | `403`; nunca consultar/escribir el tenant pedido | `branches.service.spec.ts` |
| `GET/POST/PATCH /terminals` | `?tenantId`, `body.tenantId` o sucursal cruzada | JWT + `TerminalsService` | `403`; validar sucursal dentro del tenant efectivo | `terminals.service.spec.ts` |
| `GET /inventory/products`, órdenes y compras | `?tenantId`, `?branchId` o `body.tenantId` | JWT/contexto + scope de servicio | `403` o filtro por tenant autenticado; no sustitución | servicios `inventory`, `order` y `purchase` |
| Pricing y promociones | `body.tenantId` o filtros de tenant | JWT (`request.user.tenantId`) | Usar tenant JWT; payload alterno no cambia cálculo ni escritura | `pricing.controller.spec.ts`, `promotions.controller.spec.ts` |
| `POST/GET /terminal-devices` | `body.tenantId` o `?tenantId` | JWT + rol `SUPER_ADMIN` | Solo operación global explícita de `SUPER_ADMIN`; otro rol recibe `403` | `terminal-devices.service.spec.ts` |
| `/tenants/:id/*`, permisos y menú admin | `:id`, `?tenantId` o body de otro tenant | JWT + autorización `SUPER_ADMIN` o igualdad de tenant | `SUPER_ADMIN` puede operar globalmente; usuario normal recibe `403` | guards/controllers de tenants, permisos y menú |

La excepción global está limitada a endpoints que ya requieren `SUPER_ADMIN` (por
ejemplo, administración de tenants, permisos, menú y dispositivos). El valor
seleccionado por ese rol es un alcance autorizado, no una sustitución de la
identidad tenant del JWT. No se agrega un header de tenant confiable.

## Refresh token

El frontend actual envía `refreshToken` en el cuerpo de `POST /auth/refresh`. También mantiene compatibilidad con sesiones recordadas en `localStorage`, sesiones no persistentes en memoria y la migración del valor legado de `sessionStorage`.

Mover el token a una cookie `HttpOnly` no es seguro como cambio aislado de frontend. Requiere que el backend emita, rote y revoque la cookie; defina `Secure`, `SameSite`, dominio y ruta; aplique protección CSRF; y deje de devolver o aceptar el token en JavaScript después de una ventana de compatibilidad. Hasta que ese contrato coordinado exista, se conservó el flujo actual y se agregaron pruebas sobre persistencia y migración.

Plan mínimo coordinado:

1. Backend: emitir y rotar el refresh token en cookie `HttpOnly`, con revocación por sesión.
2. Backend: proteger el refresh contra CSRF y documentar CORS/cookie para los dominios reales.
3. Frontend: preferir la cookie y mantener lectura heredada solo durante la migración.
4. Backend y frontend: retirar el token del cuerpo y limpiar `localStorage`/`sessionStorage` al cerrar la ventana de compatibilidad.
