# Consideraciones futuras de offline para Electron

Fecha: 2026-06-20  
Alcance: investigacion futura. No es diseno offline completo.

## Decision actual

Offline no entra en esta fase.

Esta fase no implementa:

- Offline.
- Service worker.
- PWA.
- Sync engine.
- Sync queue.
- IndexedDB o almacenamiento local nuevo.
- Ventas offline.
- Reconciliacion.
- Cambios de persistencia.
- Cambios de API.
- Cambios de permisos.
- Cambios de SQL.

Electron se analiza ahora como contenedor desktop online. La operacion offline queda como linea futura.

## Estado actual relacionado

El frontend ya usa almacenamiento local para estado de experiencia, no para operacion offline:

- `web/store/pos.ts`: contexto POS en `localStorage`.
- `web/store/posCart.ts`: carrito POS por contexto en `localStorage`.
- `web/domains/auth/session.ts`: refresh token en memoria o `sessionStorage` segun env.
- `web/domains/auth/menu-cache.ts`: cache de menu en `sessionStorage`.

Eso no equivale a offline. No hay cola de sincronizacion offline POS ni reconciliacion local.

## Componentes futuros posibles

Una fase offline futura podria investigar:

- Almacenamiento local transaccional.
- Sesion autorizada previamente.
- Snapshot de catalogo.
- Snapshot de permisos.
- Snapshot de precios/promociones.
- Snapshot de impuestos.
- Snapshot de clientes frecuentes o consumidor final.
- Ventas offline.
- Consecutivos temporales.
- Cola de sincronizacion.
- Reintentos.
- Reconciliacion.
- Manejo de conflictos.
- Auditoria de sync.
- Dashboard de pendientes/sincronizados/fallidos.

## Riesgos a investigar

| Riesgo | Por que importa |
| --- | --- |
| Stock vendido en varias terminales | Puede producir sobreventa si dos cajas venden el mismo inventario sin servidor. |
| Cambios de precios/promociones | Una terminal offline podria vender con precio viejo. |
| Caja cerrada en servidor | Una caja local podria seguir vendiendo contra sesion invalida. |
| Duplicados | Reintentos o reconexiones pueden duplicar ventas/pagos. |
| Facturacion electronica | Puede exigir autorizacion, numeracion, reglas fiscales y conectividad segun pais/proveedor. |
| Consecutivos temporales | Hay que reconciliar numeracion local con numeracion oficial. |
| Permisos cambiados | Un usuario offline podria operar con permisos revocados. |
| Cliente/fiscalidad | Datos fiscales pueden cambiar o estar incompletos. |
| Pagos | Medios electronicos pueden no confirmar offline. |
| Auditoria | Eventos locales deben ser confiables y no manipulables. |

## Preguntas futuras

- Cuanto tiempo maximo se permitiria operar offline.
- Que roles pueden operar offline.
- Que productos se pueden vender offline.
- Como bloquear o limitar ventas sin stock confirmado.
- Que medio de pago se permite offline.
- Como generar recibos temporales.
- Como informar al cajero que una venta aun no esta sincronizada.
- Como resolver conflicto de precio, stock, caja o permiso.
- Como auditar manipulacion del almacenamiento local.

## Linea conceptual futura

Una ruta prudente para offline seria:

1. Investigacion offline sin implementacion.
2. Diseno offline formal.
3. Modelo de datos local y seguridad.
4. Contratos API idempotentes.
5. Cola de sync y reconciliacion.
6. Dashboard de sync/auditoria.
7. Piloto controlado con hardware y usuarios reales.

## Limite de esta fase

La decision actual es no implementar offline. No se instalan dependencias. No se crea service worker. No se crea sync engine. No se modifica persistencia. No se modifica el backend ni el frontend.
