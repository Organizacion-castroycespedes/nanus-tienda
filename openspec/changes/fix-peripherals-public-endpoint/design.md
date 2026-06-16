## Context

La app web publica se sirve por HTTPS en `www.apptiendamanus.space`. La pagina tenant-aware `/{tenant}/admin/peripherals` hoy toma defaults de `web/domains/peripherals/api.ts` y puede terminar llamando `http://localhost:4050` y `ws://localhost:4050/peripherals` desde el navegador de produccion.

Ese comportamiento solo es valido para desarrollo local. En produccion, `localhost` apunta al equipo del usuario, HTTP desde HTTPS puede ser bloqueado por mixed content y el backend de perifericos necesita CORS/preflight para origenes publicos permitidos.

## Goals / Non-Goals

**Goals:**
- Usar `localhost:4050` solo cuando `NODE_ENV !== "production"` o cuando el operador lo configure explicitamente.
- Requerir `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL` en produccion y validarla como URL HTTPS.
- Derivar una URL WS segura (`wss://.../peripherals`) desde la URL HTTP cuando no exista `NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL`.
- Exponer en frontend un estado de configuracion que permita distinguir configuracion faltante, URL invalida, agent offline y error HTTP/CORS/red.
- Mantener `/[tenant]/admin/peripherals` sin cambiar la ruta, permisos ni navegacion multi-tenant.
- Ajustar `backend-perifericos` para que CORS y `OPTIONS` cubran `GET /health`, `GET /devices`, `POST /devices`, `GET /logs` y endpoints existentes.
- Documentar variables, ejemplos dev/prod y evidencia tecnica.

**Non-Goals:**
- No introducir proxy en el backend API principal.
- No mover reglas RBAC/menu ni modificar seeds tenant.
- No habilitar hardware real, drivers, USB, serial, HID, Electron ni Capacitor.
- No cambiar contratos funcionales de impresion, caja, balanza o scanner.

## Decisions

1. Centralizar configuracion en `web/domains/peripherals/api.ts`.

   La capa HTTP/WS debe exportar `getPeripheralAgentConfig()` o equivalente con `httpUrl`, `wsUrl`, `isConfigured`, `statusCode` y mensaje. Componentes React consumen ese contrato y no arman URLs manualmente.

   Alternativa considerada: dejar defaults en cada componente. Se descarta porque duplica reglas y reintroduce `localhost` hardcodeado.

2. Produccion falla temprano si falta URL publica.

   En produccion, si `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL` falta, esta vacia, usa `localhost`, usa `127.0.0.1` o usa `http://`, la UI debe mostrar "configuracion faltante/invalida" y no intentar `fetch`.

   Alternativa considerada: permitir HTTP local en produccion para agents instalados en caja. Se descarta para esta web HTTPS publica porque causa mixed content y apunta al equipo del usuario.

3. Desarrollo conserva fallback local.

   En desarrollo local, si no hay variables, `http://localhost:4050` y `ws://localhost:4050/peripherals` siguen disponibles para smoke de mock agent.

   Alternativa considerada: exigir env tambien en dev. Se descarta porque rompe el flujo local existente.

4. Errores frontend usan codigos estables.

   La capa de cliente debe clasificar errores como `MISSING_CONFIG`, `INVALID_CONFIG`, `AGENT_OFFLINE`, `HTTP_ERROR` o `NETWORK_ERROR`. La UI mapea esos codigos a mensajes concretos.

   Alternativa considerada: continuar lanzando solo `Error(message)`. Se descarta porque la UI no puede distinguir mala config de CORS/red/offline.

5. CORS queda explícito en `backend-perifericos`.

   `PERIPHERALS_ALLOWED_ORIGINS` sigue siendo la fuente de verdad. Requests sin `Origin` se permiten para curl/Postman. Requests con `Origin` no permitido deben fallar CORS. Preflight `OPTIONS` debe responder 204 para origen permitido y headers/metodos necesarios.

   Alternativa considerada: wildcard `*`. Se descarta porque produccion necesita origenes controlados.

## Risks / Trade-offs

- [Risk] Una instalacion que esperaba acceder a un agent local desde la web publica dejara de intentar conectar.
  Mitigation: documentar que produccion web publica requiere URL HTTPS publica o proxy seguro del servicio de perifericos.

- [Risk] La URL publica de `backend-perifericos` puede no existir aun en infraestructura.
  Mitigation: UI muestra configuracion faltante/invalida sin romper la pagina y deja evidencia de env requerida.

- [Risk] CORS puede quedar mal configurado en despliegue.
  Mitigation: agregar prueba/smoke de `OPTIONS /devices` con `Origin` permitido y documentar `PERIPHERALS_ALLOWED_ORIGINS`.

- [Risk] WebSocket puede requerir ruta o dominio distinto al HTTP.
  Mitigation: permitir `NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL` explicita y derivar `wss://.../peripherals` solo como fallback.

## Migration Plan

1. Desplegar `backend-perifericos` con `PERIPHERALS_ALLOWED_ORIGINS=https://www.apptiendamanus.space` mas origenes QA que apliquen.
2. Publicar el servicio de perifericos detras de HTTPS.
3. Configurar web produccion con `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL=https://<public-peripherals-host>`.
4. Opcionalmente configurar `NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL=wss://<public-peripherals-host>/peripherals`.
5. Validar `GET /health`, `GET /devices`, `GET /logs` y preflight `OPTIONS /devices` desde origen publico.

Rollback: quitar variables publicas o desactivar `NEXT_PUBLIC_PERIPHERALS_ENABLED=false`; la pagina debe mostrar estado controlado sin romper navegacion.

## Open Questions

- Cual sera el hostname publico definitivo de `backend-perifericos` en produccion.
- Si el servicio publico de perifericos vivira directo en `backend-perifericos` o detras de reverse proxy HTTPS.
