# Arquitectura funcional - Modulo Domicilios Manus POS

## Objetivo del modulo

El modulo Domicilios busca controlar entregas asociadas a clientes, pedidos, ventas/facturas y caja cuando exista impacto de dinero. El objetivo es dar trazabilidad operativa desde que se registra el domicilio hasta que queda entregado, cancelado o no entregado.

Esta fase es solo arquitectura funcional y OpenSpec. No implementa codigo.

## Alcance v0.0.1

- Registrar y consultar domicilios de forma conceptual.
- Asociar domicilios con cliente, direccion de entrega, pedido, venta/factura y caja/turno cuando aplique.
- Definir estados, transiciones y datos minimos.
- Proponer permisos `DELIVERIES_*`.
- Definir UX esperada: menu, listado, filtros, detalle, acciones por estado, responsive y estados vacios.
- Documentar reporterias futuras.
- Documentar riesgos Web/Electron sin disenar offline.

## Fuera de alcance

- No backend funcional.
- No frontend funcional.
- No SQL, tablas, migraciones ni seeds.
- No endpoints.
- No cambios reales en `menu_items` ni `role_menu_permissions`.
- No cambios en clientes.
- No cambios en pedidos.
- No cambios en facturacion.
- No cambios en caja.
- No cambios en reportería.
- No commit sin aprobacion.

## Entidades conceptuales

### Delivery

Entidad conceptual futura para cada domicilio.

Campos minimos esperados:
- `tenantId`: tenant propietario.
- `branchId`: sucursal operativa cuando aplique.
- `customerId`: cliente asociado cuando exista.
- `customerSnapshot`: nombre, documento, telefono y datos visibles usados en el momento.
- `deliveryAddress`: direccion de entrega usada.
- `neighborhoodOrZone`: barrio, zona o referencia.
- `contactPhone`: telefono de contacto.
- `sourceType`: `ORDER`, `SALE`, `INVOICE` o `MANUAL`.
- `sourceId`: id del pedido, venta o factura asociada cuando exista.
- `status`: estado operativo.
- `responsibleUserId`: usuario/repartidor cuando aplique.
- `shippingAmount`: valor del domicilio/envio cuando aplique.
- `paymentMethod`: metodo de pago del domicilio cuando aplique.
- `paymentStatus`: pagado, contra entrega, pendiente o por conciliar en diseno futuro.
- `cashSessionId`: caja/turno asociado solo si afecta caja.
- `createdByUserId`: usuario que registra.
- `createdAt`: fecha/hora de creacion.
- `dispatchedAt`: fecha/hora de despacho.
- `deliveredAt`: fecha/hora de entrega.
- `notes`: observaciones.

### DeliveryStatusEvent

Entidad conceptual futura para trazabilidad.

Debe registrar:
- Estado anterior.
- Estado nuevo.
- Usuario actor.
- Fecha/hora.
- Motivo u observacion.
- Contexto de caja cuando la accion afecte dinero.

### DeliveryCollection

Entidad conceptual futura si se confirma pago contra entrega o recaudo por repartidor.

Debe registrar:
- Valor esperado.
- Valor recaudado.
- Diferencia.
- Metodo de pago.
- Responsable del recaudo.
- Caja/turno o flujo de conciliacion.

## Estados del domicilio

Estados v0.0.1 propuestos:
- `PENDIENTE`
- `EN_PREPARACION`
- `DESPACHADO`
- `ENTREGADO`
- `CANCELADO`
- `NO_ENTREGADO`

No se recomiendan estados adicionales para v0.0.1. Asignacion, pago, recaudo y reintento son ejes distintos. Si se vuelven estados, el flujo se vuelve barro tecnico. Barro pega en botas, y tambien en caja.

### Transiciones permitidas

| Estado actual | Estados permitidos | Regla |
| --- | --- | --- |
| `PENDIENTE` | `EN_PREPARACION`, `DESPACHADO`, `CANCELADO` | Puede prepararse, salir directo o cancelarse antes de despacho. |
| `EN_PREPARACION` | `DESPACHADO`, `CANCELADO` | Puede salir a reparto o cancelarse antes de despacho. |
| `DESPACHADO` | `ENTREGADO`, `NO_ENTREGADO` | Debe cerrar como entregado o no entregado. |
| `ENTREGADO` | Ninguno | Estado final. |
| `CANCELADO` | Ninguno | Estado final. |
| `NO_ENTREGADO` | Ninguno en v0.0.1 | Estado final del intento. Reintento queda para fase futura. |

### Reglas transversales

- Toda transicion debe registrar actor, fecha/hora, estado anterior, estado nuevo y observacion/motivo cuando aplique.
- `ENTREGADO`, `CANCELADO` y `NO_ENTREGADO` no deben mutar en v0.0.1.
- Reintentos deben disenar una entidad de intentos o un domicilio sucesor enlazado.

## Integracion con clientes

El domicilio debe integrarse con Clientes sin exigir cambios en esta fase.

Decisiones:
- Un cliente puede tener multiples direcciones en el futuro.
- v0.0.1 debe permitir direccion puntual escrita en pedido/domicilio.
- El domicilio debe guardar snapshot de direccion y telefono.
- Cliente generico o consumidor final puede permitirse si el flujo existente lo permite, pero el domicilio debe exigir direccion, telefono y referencia de contacto.
- Si el cliente no tiene direccion registrada, la direccion de entrega es obligatoria en el domicilio.

Informacion minima visible del cliente:
- Nombre o razon social.
- Documento cuando exista.
- Telefono de contacto.
- Direccion usada para el domicilio.
- Historial o conteo de domicilios solo en fase futura de reporteria.

## Integracion con pedidos

Un pedido puede generar un domicilio cuando requiere entrega.

Recomendacion v0.0.1:
- Un pedido tiene maximo un domicilio activo.
- Multiples entregas, entregas parciales o reintentos quedan fuera de v0.0.1.
- El domicilio puede crearse manualmente o desde pedido confirmado.
- Facturar el pedido no debe ser el unico momento de creacion.
- El pedido puede mostrar estado de domicilio como badge o seccion relacionada.
- El estado de domicilio no reemplaza el estado del pedido.

Reglas de cancelacion:
- Pedido cancelado antes de despacho: domicilio debe cancelarse con motivo.
- Pedido cancelado despues de despacho: requiere resolucion explicita como `NO_ENTREGADO` o excepcion supervisada.
- Domicilio cancelado antes de despacho: pedido puede seguir como retiro en tienda, venta sin domicilio o cancelarse segun regla de pedidos.

## Integracion con facturacion

El domicilio puede existir antes o despues de facturar.

Puntos clave:
- Si el valor de envio se cobra al cliente, debe tener una fuente financiera/fiscal unica.
- Recomendacion futura: si es cobro al cliente, incluirlo en factura/POS como cargo/linea aprobada.
- Si es costo interno de operacion, no debe cobrarse como ingreso de factura.
- No debe existir doble cobro entre factura, domicilio y caja.

Anulaciones:
- Factura anulada antes de despacho: bloquear despacho o cancelar domicilio con trazabilidad.
- Factura anulada despues de entrega: no borrar entrega; resolver con nota credito/reversion financiera.
- Factura anulada despues de `NO_ENTREGADO`: conservar fallo logistico y resolver dinero aparte.

## Integracion con caja

El domicilio afecta caja solo si hay dinero.

Casos:
- Pagado previamente en POS/factura: el domicilio no crea recaudo nuevo.
- Contra entrega: requiere registrar valor esperado, valor recaudado, metodo de pago, responsable y caja/turno o conciliacion.
- Recaudo por repartidor: requiere definir si el dinero entra al turno actual, a caja del repartidor o a liquidacion posterior.
- Sin valor de envio: no debe afectar caja.

Casos sensibles:
- `NO_ENTREGADO` con pago previo: requiere decision de reembolso, nota credito o reintento futuro.
- `CANCELADO` con envio cobrado: requiere resolucion financiera.
- Diferencia entre valor facturado, valor domicilio y valor recaudado: debe quedar marcada para revision.

Reportes de caja futuros:
- Recaudo por domicilio.
- Recaudo por repartidor.
- Recaudo por caja/turno.
- Diferencias por domicilio.
- Domicilios no entregados con dinero pendiente.

## Permisos propuestos

Permisos a evaluar:
- `DELIVERIES_VIEW`
- `DELIVERIES_CREATE`
- `DELIVERIES_UPDATE`
- `DELIVERIES_ASSIGN`
- `DELIVERIES_DISPATCH`
- `DELIVERIES_MARK_DELIVERED`
- `DELIVERIES_CANCEL`
- `DELIVERIES_REPORTS`

Propuesta inicial por rol:

| Permiso | SUPER_ADMIN | SUPER_USER | ADMIN | USER |
| --- | --- | --- | --- | --- |
| `DELIVERIES_VIEW` | Si | Si | Si | Si, con scope |
| `DELIVERIES_CREATE` | Si | Si | Si | Si, operativo |
| `DELIVERIES_UPDATE` | Si | Si | Si | Limitado |
| `DELIVERIES_ASSIGN` | Si | Si | Si | No por defecto |
| `DELIVERIES_DISPATCH` | Si | Si | Si | No por defecto |
| `DELIVERIES_MARK_DELIVERED` | Si | Si | Si | Solo si se aprueba rol operativo |
| `DELIVERIES_CANCEL` | Si | Si | Si | No por defecto |
| `DELIVERIES_REPORTS` | Si | Si | Si | Solo lectura limitada si se aprueba |

No se aplica esta matriz en esta fase.

## UX / UI esperada

### Menu

Nueva opcion futura:
- `Domicilios`
- Ruta conceptual: `/{tenant}/deliveries`
- Permiso conceptual: `DELIVERIES_VIEW`

### Listado

Columnas sugeridas:
- Estado.
- Cliente.
- Telefono.
- Direccion/zona.
- Pedido/factura.
- Repartidor/responsable.
- Valor envio.
- Metodo/estado de pago.
- Creado.
- Despachado.
- Entregado.
- Acciones.

Filtros:
- Estado.
- Cliente.
- Fecha.
- Pedido/factura.
- Repartidor.
- Caja/turno cuando aplique.

### Detalle

Debe mostrar:
- Datos del cliente.
- Direccion y referencia.
- Fuente asociada.
- Estado actual.
- Historial de estados.
- Responsable.
- Valores y pago.
- Caja/turno si aplica.
- Observaciones.
- Acciones segun estado y permisos.

### Acciones por estado

- `PENDIENTE`: preparar, despachar, cancelar, editar.
- `EN_PREPARACION`: despachar, cancelar, editar.
- `DESPACHADO`: marcar entregado, marcar no entregado.
- `ENTREGADO`: ver detalle.
- `CANCELADO`: ver detalle.
- `NO_ENTREGADO`: ver detalle.

### Responsive

- Sin overflow horizontal.
- Filtros colapsables en movil.
- Acciones primarias visibles.
- Tabla puede pasar a lista compacta en movil.
- Estados con chips/indicadores claros.

### Estados vacios y mensajes

- Sin domicilios.
- Sin resultados por filtros.
- Error al cargar.
- Accion no permitida.
- Falta caja abierta para accion con dinero.
- Falta direccion o telefono.
- Confirmacion antes de cancelar, entregar o marcar no entregado.

## Reporteria futura

Reportes requeridos:
- Domicilios pendientes.
- Domicilios despachados.
- Domicilios entregados.
- Domicilios cancelados.
- Domicilios no entregados.
- Recaudo por domicilio.
- Recaudo por repartidor.
- Recaudo por caja/turno.
- Tiempo promedio de entrega.
- Domicilios por cliente.
- Domicilios por zona/barrio.

Metricas utiles:
- Tiempo creacion -> despacho.
- Tiempo despacho -> entrega.
- Tasa de no entregados.
- Diferencias de recaudo.
- Domicilios por responsable.

## Multitenant

Reglas:
- Todo domicilio pertenece a un `tenant_id`.
- Actores no globales solo ven domicilios de su tenant.
- Scope por sucursal debe aplicar cuando el rol lo requiera.
- `SUPER_ADMIN` puede requerir selector de tenant para operar.
- No se debe exponer cliente, pedido, factura o caja entre tenants.
- Todas las consultas futuras deben filtrar por tenant y scope operativo.

## Offline / Electron

Tipos:
- Tipo A Web 100 percent: operacion online, servidor como fuente de verdad.
- Tipo B Electron 100 percent: puede requerir operacion local parcial, pero no se disena en esta fase.
- Tipo D Web + Electron: riesgo de conflictos entre cliente web y cliente desktop.

Riesgos:
- Doble despacho.
- Estado entregado registrado dos veces.
- Pago contra entrega duplicado.
- Caja descuadrada por sincronizacion tardia.
- Factura anulada offline mientras domicilio aparece entregado.

Recomendacion:
- No implementar offline hasta tener idempotencia, cola local, reconciliacion, versionado de estado y reglas de caja.

## Riesgos

- Doble fuente de verdad entre domicilio, factura y caja.
- Reintentos no modelados si `NO_ENTREGADO` no basta.
- Cliente generico con baja trazabilidad.
- Domicilios con pago contra entrega sin caja abierta.
- Roles demasiado amplios para cancelar o despachar.
- Multiples domicilios por pedido no soportados en v0.0.1.
- Offline/Electron sin reconciliacion puede romper dinero y estados.

## Decisiones pendientes

- Definir si repartidor sera usuario interno, tercero externo o ambos.
- Definir si el envio cobrado al cliente siempre se factura.
- Definir si `NO_ENTREGADO` debe permitir reintento en v0.0.2.
- Definir si un pedido puede tener entregas parciales.
- Definir si caja del repartidor existe o si todo recaudo entra al turno del cajero.
- Definir quien puede marcar entregado en operacion real.
- Definir si hay impresion de comprobante de domicilio.

## Recomendacion de implementacion por fases

### Fase 1

OpenSpec + arquitectura funcional.

### Fase 2

Modelo de datos y migraciones.

### Fase 3

Backend API y reglas de negocio.

### Fase 4

Frontend modulo Domicilios.

### Fase 5

Integracion con pedidos/facturacion/caja.

### Fase 6

Reporteria y auditoria.

### Fase 7

QA integral y hardening.

## Confirmacion de alcance de esta fase

- Codigo backend tocado: NO.
- Codigo frontend tocado: NO.
- SQL/migraciones tocadas: NO.
- Permisos reales modificados: NO.
- Logica de negocio modificada: NO.
- Commit realizado: NO.
