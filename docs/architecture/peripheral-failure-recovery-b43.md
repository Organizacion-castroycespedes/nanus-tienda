# Fallos y recuperación de periféricos — B4.3

| Fallo | Tratamiento implementado | Recuperación | Garantía pendiente |
|---|---|---|---|
| Agent ausente | Electron health devuelve no disponible; Web muestra warning | Reinicio/reintento de conexión según shell | Agent disponible en ambiente |
| HTTP Agent timeout | `agent-client` destruye request y rechaza | Reintento manual/operación posterior | Reintento automático de job |
| Respuesta Agent inválida | Rechazo `AGENT_RESPONSE_INVALID` | Corregir Agent/configuración | Diagnóstico operativo completo |
| Adapter real apagado | HTTP controlado con mensaje | Activar flag aprobado | Seguridad de activación |
| Impresora sin cola USB | Rechazo de cola requerida | Configurar cola Windows | Prueba física |
| Socket NETWORK error | Error controlado y estado no reachable | Reintentar impresión | Idempotencia del ticket |
| Socket NETWORK timeout | Timeout de transporte | Reintento manual | Confirmar si impresora recibió bytes |
| Impresora sin papel | Solo error del transporte/adaptador si llega | Intervención física | Detección uniforme |
| Cajón no disponible | Error/log; venta no cambia | Reintentar apertura | Evitar doble pulso |
| Scanner desconocido | Toast y log; no agrega producto | Nueva lectura | Matching remoto |
| Scanner duplicado | Cada evento válido puede agregar/incrementar | Control manual | Deduplicación temporal |
| Balanza offline | UI muestra error/lectura no aplicada | Nueva lectura | Driver real |
| Peso inestable/no positivo | UI rechaza lectura | Repetir lectura | Exactitud metrológica |
| Venta confirmada sin ticket | Warning posterior al commit | Reimpresión manual si existe | Reimpresión automática/idempotente |

## Fronteras

La venta comercial y la impresión son procesos separados. `UNKNOWN` de B4.2
significa resultado comercial incierto y se reconcilia con la clave de venta.
Un fallo del Agent después de `SaleResponse` no debe tratarse como venta incierta.

No se encontró cola durable, outbox de impresión, confirmación física de papel,
reintento automático de ticket ni deduplicación por `jobId`.
