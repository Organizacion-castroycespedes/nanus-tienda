# Matriz de estados y errores frontend POS — B4.2

| Estado | Ubicación | Entrada | Salida | Protección |
|---|---|---|---|---|
| `DRAFT` | `posCart.saleStatus` | Carrito editable | Cobro o cambio local | Edición permitida |
| `SUBMITTING` | `posCart.saleStatus` | `beginSaleSubmission` | 2xx, 4xx o incierto | Store bloquea edición |
| `UNKNOWN` | `posCart.saleStatus` | Error no definitivo | Reconciliación | Impide nuevo envío ciego |
| `CONFIRMED` | `posCart.saleStatus` | Respuesta 2xx | Limpieza y nuevo draft | Carrito se vacía |
| `PENDING` línea | `PosCartItem.pricingStatus` | Cambio de ítem/contexto | Preview OK/error | Cobro bloqueado |
| `READY` línea | `PosCartItem.pricingStatus` | Preview OK | Nuevo cambio o envío | Snapshot visible |
| `ERROR` línea | `PosCartItem.pricingStatus` | Error de pricing | Reintento | Cobro bloqueado |
| caja ausente | `currentCashSession` | Contexto sin caja | Abrir caja o rechazo | Efectivo bloqueado |
| scanner disabled/error | estado local PosScreen | Flag o Agent | Habilitar/reintentar | Producto manual sigue posible |

## Errores y tratamiento

| Evento | Tratamiento Web | Reintento | Garantía no demostrada |
|---|---|---|---|
| Doble Enter/click durante cobro | `isSubmitting`, `canConfirmRef` | No automático | No cubre dos pestañas |
| Scanner duplicado | Cada match válido agrega/incrementa | No temporal | Deduplicación completa |
| Scanner lento/ambiguo | Wedge ignora secuencia o no encuentra único | Nueva lectura | Hardware físico |
| Precio sin red | Línea queda `PENDING` | Evento online/backend-restored | Que el evento siempre dispare |
| Precio rechazado | Línea `ERROR`, toast | Cambio/reintento | Reglas iguales entre ambientes |
| HTTP 4xx | Vuelve a `DRAFT`, conserva carrito | Manual | No clasifica todos los códigos de negocio |
| Timeout/5xx/fetch | `UNKNOWN`, conserva clave | Reconciliación manual | Resultado siempre consultable |
| Reconciliación 404 | Mensaje y misma clave | Esperar/revisar | Que no exista venta tardía |
| Reconciliación 409 | Venta pendiente | Esperar y verificar | Tiempo de resolución |
| 401 | Refresh una vez y reintento HTTP | Automático | Refresh válido y autorización completa |
| Caja cerrada/stock/pago | Mensaje genérico de rechazo | Corregir contexto/datos | Que UI refleje causa exacta |
| Impresión/Agent offline | Venta queda guardada, warning | Operación periférica separada | Reimpresión automática |

La protección contra doble venta es compartida: bloqueo visual más idempotencia
backend. No se debe presentar como garantía del navegador completo.
