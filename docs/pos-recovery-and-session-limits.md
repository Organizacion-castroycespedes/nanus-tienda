# Límites de recuperación y sesión del POS

## Recuperación de una venta ambigua

Electron sigue siendo un shell del frontend web. No existe una base transaccional local ni se ofrece venta offline.

El contrato actual crea ventas con `POST /sales` y permite consultar una venta conocida con `GET /sales/:id`. El cliente no conoce el `saleId` antes del POST y el contrato no recibe una clave de idempotencia. Por eso no se puede consultar de forma inequívoca el resultado de una solicitud que perdió su respuesta.

La protección implementada es local y conservadora:

- el carrito continúa aislado por tenant, sucursal, terminal, usuario y sesión POS;
- antes del POST se persiste un identificador local del intento y el estado `SUBMITTING`;
- si la aplicación reinicia durante ese estado, se recupera como `UNKNOWN`;
- una respuesta HTTP 4xx habilita la corrección y el reintento porque el servidor rechazó la solicitud;
- una caída de red o respuesta 5xx conserva el carrito y bloquea el reintento automático;
- el operador debe revisar las ventas registradas y habilitar manualmente otro intento.

Este mecanismo reduce duplicados accidentales, pero no puede demostrar por sí solo si el servidor confirmó la venta. Para reconciliación automática hace falta un cambio de contrato backend: aceptar una clave de idempotencia generada por el cliente, persistirla junto con la venta y exponer una consulta por esa clave dentro del tenant autenticado.

## Refresh token

El frontend actual envía `refreshToken` en el cuerpo de `POST /auth/refresh`. También mantiene compatibilidad con sesiones recordadas en `localStorage`, sesiones no persistentes en memoria y la migración del valor legado de `sessionStorage`.

Mover el token a una cookie `HttpOnly` no es seguro como cambio aislado de frontend. Requiere que el backend emita, rote y revoque la cookie; defina `Secure`, `SameSite`, dominio y ruta; aplique protección CSRF; y deje de devolver o aceptar el token en JavaScript después de una ventana de compatibilidad. Hasta que ese contrato coordinado exista, se conservó el flujo actual y se agregaron pruebas sobre persistencia y migración.

Plan mínimo coordinado:

1. Backend: emitir y rotar el refresh token en cookie `HttpOnly`, con revocación por sesión.
2. Backend: proteger el refresh contra CSRF y documentar CORS/cookie para los dominios reales.
3. Frontend: preferir la cookie y mantener lectura heredada solo durante la migración.
4. Backend y frontend: retirar el token del cuerpo y limpiar `localStorage`/`sessionStorage` al cerrar la ventana de compatibilidad.
