# Evidencia: rotación de credencial QA de FactuCore

## Estado

- Incidente: credencial de API QA expuesta en diagnóstico local.
- Ambiente verificado: QA/TEST; producción excluida por tenant `TEST` y endpoint local.
- Rotación ejecutada: una, sobre el cliente QA autorizado.
- Historial Git: no reescrito. La deuda histórica sigue documentada por separado.

## Autoridad y mecanismo

- Tipo: credencial de cliente API de FactuCore.
- Autenticación: headers `x-client-key` y `x-client-secret`.
- Autoridad: registro `api_clients` de FactuCore.
- Almacenamiento: `api_secret_hash` con comparación bcrypt.
- Rotación: `ApiClientsService.regenerateSecret`.
- Revocación: reemplazo del hash; la credencial anterior fue rechazada.
- Cliente: `60cbac48-f476-4f34-9664-6ba27df95d23`.
- Tenant: `d5bacedc-c3cd-48bf-b1a9-e4327ef0ffdc`.

No se registran secretos, hashes, headers completos ni contenido de `.env`.

## Verificación

- Credencial nueva: autenticación PASS.
- Credencial anterior: REJECTED.
- Endpoint autenticado de lectura: HTTP `200`.
- Health liveness local: HTTP `200` en `/api/health`.
- Peticiones mutantes de negocio: `0`.
- Llamadas DIAN: `0`.
- Cliente FactuCore de Manus: no activado; proveedor permanece `MOCK_LOCAL`.
- `DIAN_ALLOW_EXTERNAL_CALLS`: `false`.
- Worker global Manus: deshabilitado.
- Workers FactuCore: deshabilitados.
- Procesamiento histórico: no ejecutado.

## Configuración local

La nueva credencial quedó solamente en la configuración QA local ignorada.
No se creó ningún secreto rastreado. No se modificó código fuente.

## Decisión

La credencial QA expuesta quedó cerrada y la autenticación QA está lista.
La promoción del proveedor y el E2E controlado siguen siendo tareas aparte.
La exposición histórica de Git continúa como `OPEN_ACCEPTED_RISK` hasta una
rotación/revocación coordinada y un eventual purge aprobado.
