## Why

La pagina `/admin/peripherals` falla en produccion porque el navegador intenta llamar `http://localhost:4050` desde una web HTTPS publica. Eso apunta al equipo del usuario, puede disparar mixed content, CORS/preflight, y deja el backend de perifericos sin configuracion por ambiente.

## What Changes

- Centralizar la URL HTTP/WS del backend de perifericos en una configuracion frontend validada por ambiente.
- Mantener `http://localhost:4050` y `ws://localhost:4050/peripherals` solo como defaults de desarrollo local.
- Requerir URL publica HTTPS/WSS configurable cuando la app corre en produccion.
- Eliminar llamadas hardcodeadas a `localhost:4050` desde componentes React.
- Mostrar estados claros en `/admin/peripherals` para backend disponible, backend no disponible, configuracion faltante y errores CORS/red.
- Ajustar `backend-perifericos` para responder CORS y `OPTIONS` de forma correcta para origenes permitidos.
- Documentar variables de ambiente, smoke checks y evidencia tecnica.
- Preservar la navegacion multi-tenant existente hacia `/{tenant}/admin/peripherals`.

## Capabilities

### New Capabilities
- `peripherals-public-endpoint`: Contrato de configuracion, CORS y estados UI para consumir el backend de perifericos desde desarrollo y produccion.

### Modified Capabilities
- Ninguna. No existe spec base archivada de `peripherals` en `openspec/specs/`; esta correccion queda como capacidad nueva y focalizada.

## Impact

- `web/domains/peripherals/*`: cliente HTTP/WS, contratos, README y pantalla administrativa.
- `web/.env.example`: variables publicas para URL HTTP/WS por ambiente.
- `backend-perifericos/*`: CORS, preflight `OPTIONS`, README y pruebas/smoke.
- `openspec/changes/fix-peripherals-public-endpoint/*`: propuesta, diseno, spec, tareas y evidencia.
- Sin cambios esperados en rutas multi-tenant ni seeds de menu/RBAC.
