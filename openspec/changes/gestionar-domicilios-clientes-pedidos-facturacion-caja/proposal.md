## Why

Manus POS ya opera clientes, pedidos, POS, facturacion, caja y reporteria, pero no tiene un contrato formal para controlar domicilios como flujo operativo propio. Antes de tocar backend, frontend, SQL, permisos o caja, se requiere una fase OpenSpec que defina alcance, reglas y riesgos del modulo.

## What Changes

- Definir el modulo funcional "Domicilios" para registrar, consultar y hacer seguimiento de entregas asociadas a clientes, pedidos, ventas/facturas y caja cuando aplique.
- Formalizar estados operativos iniciales, transiciones permitidas, estados finales y manejo de `NOT_DELIVERED` para v0.0.1.
- Documentar integraciones conceptuales con Clientes, Pedidos, Facturacion y Caja/turno actual sin modificar esos modulos.
- Proponer permisos, roles, menu, filtros, vista detalle, acciones por estado, estados vacios, responsive y reportería futura.
- Declarar restricciones explicitas: no endpoints, no tablas, no migraciones, no cambios de permisos reales, no cambios de logica productiva y no commit en esta fase.

## Capabilities

### New Capabilities
- `deliveries-management`: Gestion operativa del domicilio, datos minimos, estados, transiciones, UX base, trazabilidad, multi-tenant y consideraciones Web/Electron.
- `deliveries-customer-integration`: Integracion conceptual con clientes, direcciones, cliente generico, venta sin cliente identificado e historico de datos de entrega.
- `deliveries-orders-integration`: Integracion conceptual con pedidos, creacion desde pedido, cardinalidad, cancelaciones y visibilidad del estado de entrega.
- `deliveries-invoicing-integration`: Integracion conceptual con ventas/facturas, momento de facturacion, valor de envio, anulaciones, notas credito y trazabilidad.
- `deliveries-cash-register-integration`: Integracion conceptual con caja/turno actual, pagos contra entrega, recaudo por repartidor, diferencias y casos cancelados/no entregados.
- `deliveries-permissions`: Propuesta de permisos y roles para ver, crear, actualizar, asignar, despachar, marcar entregado, cancelar y consultar reportes.
- `deliveries-reporting`: Necesidades futuras de reporteria operativa y financiera de domicilios.

### Modified Capabilities

## Impact

- `openspec`: nuevo change de arquitectura funcional para Domicilios.
- `docs`: nuevo documento de analisis `docs/arquitectura-modulo-domicilios-manus-pos.md`.
- `api`: sin cambios funcionales en esta fase.
- `web`: sin cambios funcionales en esta fase.
- `backend-reporteria`: sin cambios funcionales en esta fase.
- `scripts/database` y SQL/migraciones: sin cambios en esta fase.
- Seguridad: el diseno exige tenant isolation, permisos por modulo/accion y trazabilidad antes de implementar.
