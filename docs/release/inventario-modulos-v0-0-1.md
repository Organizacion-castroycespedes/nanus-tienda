# Inventario de modulos v0.0.1

## Leyenda

- `COMPLETO`: listo sin observaciones relevantes para este corte.
- `FUNCIONAL_CON_OBSERVACIONES`: funciona, tiene evidencia, pero conserva riesgos o pendientes.
- `PARCIAL`: existe base tecnica o UX, falta cierre.
- `PENDIENTE`: no implementado para uso real.
- `BLOQUEADO_EXTERNO`: depende de compra, certificado, proveedor, hardware o aprobacion externa.

## Inventario principal

| Modulo | Submodulos / rutas | Backend | Frontend | Estado | Dependencias |
| --- | --- | --- | --- | --- | --- |
| POS | Venta, contexto POS, carrito, clientes, productos, impuestos, pagos, pricing, perifericos mock | `inventory/sale`, `pos-user-sessions`, `pos-terminals`, `pricing`, `finance` | `web/modules/pos`, `web/domains/pos`, `/{tenant}/pos` | `FUNCIONAL_CON_OBSERVACIONES` | Inventario, clientes, impuestos, caja, pricing, terminal |
| Pedidos / Orders | Crear, editar, confirmar, entregar, facturar, cancelar | `inventory/controllers/order.controller.ts`, `order.service.ts` | `/{tenant}/orders`, `web/modules/inventory` | `FUNCIONAL_CON_OBSERVACIONES` | Clientes, productos, pricing, inventario, caja/pagos |
| Caja / Finanzas | Cash registers, sessions, movements, methods, payments | `api/src/modules/finance/*` | `web/modules/finance`, `/{tenant}/finance/*` | `FUNCIONAL_CON_OBSERVACIONES` | POS, compras, pedidos/ventas, reportes |
| Inventario | Productos, categorias, subcategorias, lotes, ubicaciones, balances, ajustes, FEFO | `api/src/modules/inventory/*` | `/{tenant}/inventory/*`, `web/modules/inventory` | `FUNCIONAL_CON_OBSERVACIONES` | Compras, POS, pedidos, impuestos, unidades |
| Compras / Recepcion | Compras, items, recepcion total/parcial, liquidacion parcial, pagos | `purchase.controller.ts`, `purchase.service.ts` | `/{tenant}/purchases`, `/{tenant}/inventory/purchases` | `FUNCIONAL_CON_OBSERVACIONES` | Proveedores, inventario, caja/pagos, reportes |
| Clientes | Clientes legacy, customers fiscales mock, consumidor final | `customer.controller.ts`, `electronic-invoicing/customers` | `/{tenant}/customers`, POS quick fiscal customer | `FUNCIONAL_CON_OBSERVACIONES` | POS, pedidos, FE mock |
| Proveedores | Suppliers base, suppliers fiscales mock | `supplier.controller.ts`, `electronic-invoicing/suppliers` | `/{tenant}/suppliers`, `/{tenant}/inventory/suppliers` | `FUNCIONAL_CON_OBSERVACIONES` | Compras, FE mock |
| Promociones / Pricing | Pricing preview, promociones CRUD, snapshots POS/Orders | `api/src/modules/pricing/*` | `web/modules/pricing`, `/{tenant}/inventory/promotions` | `FUNCIONAL_CON_OBSERVACIONES` | Productos, impuestos, sucursales, POS, Orders |
| Impuestos | Taxes CRUD/catalogo, tax snapshot en ventas/pedidos | `tax.controller.ts`, `tax.service.ts` | `/{tenant}/inventory/taxes` | `FUNCIONAL_CON_OBSERVACIONES` | Pricing, POS, productos |
| Reportes | POS sales, purchases, cash closings, order sales, customers reports, tickets PDF | `backend-reporteria/src/modules/reports/*` | `web/modules/reporteria`, `/{tenant}/reporteria/*` | `FUNCIONAL_CON_OBSERVACIONES` | DB functions, ventas, compras, caja, pedidos |
| Seguridad / RBAC | Auth JWT, roles, menu permissions, route permissions, guards | `auth`, `roles`, `users`, `menu`, `permissions`, common guards | `web/lib/permissions.ts`, route guard/layout | `FUNCIONAL_CON_OBSERVACIONES` | Seeds/migraciones, tenant context |
| Multitenant / Branding / Configuracion | Tenants, branches, locations, branding, menu admin, terminals | `tenants`, `branches`, `locations`, `menu`, `terminals`, `pos-terminals` | `/{tenant}/configuracion`, `/{tenant}/config/terminals` | `FUNCIONAL_CON_OBSERVACIONES` | Auth, RBAC, tenant env |

## Modulos pendientes o bloqueados

| Modulo | Estado | Que existe | Que falta |
| --- | --- | --- | --- |
| Capacitor | `PENDIENTE` | Consideraciones responsive/mobile en POS visual | Proyecto nativo, build, safe areas reales, QA en dispositivo |
| Electron | `PENDIENTE` | Consideraciones desktop en POS visual | Shell Electron, empaquetado, auto-update, integracion local hardware |
| Perifericos fisicos | `BLOQUEADO_EXTERNO` | `backend-perifericos`, mocks, network adapter desactivado, configuracion terminal | Compra hardware, drivers, pruebas USB/serial/HID/red, activar real adapters |
| Facturacion electronica | `BLOQUEADO_EXTERNO` | FE mock customers/suppliers, GetAcquirer skeleton, parser/request builder, backend especializado | Certificado P12/PFX real, WSDL, habilitacion DIAN, SCA/npm audit, secretos, parser validado contra DIAN real |
| CRM | `PARCIAL` | Customers operativos y migracion `CRM_CUSTOMERS` historica | Pipeline comercial, segmentacion, comunicaciones, seguimiento y UX dedicada |
| Home / Dashboard / UX producto | `PARCIAL` | `/{tenant}/dashboard`, dashboard inventario operativo | Home de producto, KPIs ejecutivos, navegacion inicial pulida, UX gerencial |

## Dependencias entre modulos

| Flujo | Dependencias |
| --- | --- |
| POS directo | Auth/RBAC, tenant, branch, terminal, POS session, productos, clientes, impuestos, pricing, caja, pagos, inventario |
| Pedido a venta | Clientes, productos, pricing snapshot, inventario, `inventory_invoice_order`, pagos/caja, reporteria |
| Compra a stock | Proveedores, productos, lotes/ubicaciones, recepcion, pagos/caja, reporteria |
| Reportes PDF | Backend API/DB, funciones SQL/reporting, backend-reporteria, auth reporteria, plantillas PDF |
| Promocion aplicada | Productos, sucursal, impuestos, pricing service, POS/Orders, snapshots |
| Perifericos MOCK | POS, terminal config, web domains peripherals, backend-perifericos mock |
| FE mock | Customers/suppliers fiscales, env mock, POS customer fiscal, no DIAN real |

## Lo que puede hacerse antes de comprar hardware o certificado

- Hardening de UX POS web.
- QA autenticado visual en navegador.
- Tests unitarios y smoke API adicionales.
- Mejorar dashboard/home sin dependencias externas.
- Documentar runbooks y checklist de despliegue.
- Preparar feature flags y env validation.
- Preparar contratos de Electron/Capacitor sin activar packaging final.
- Preparar mocks y fixtures de DIAN/perifericos.
- Ejecutar SCA/npm audit en ambiente permitido.

## Lo que no debe entrar en v0.0.1

- Hardware real y drivers.
- `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- DIAN real, certificado real, habilitacion o produccion fiscal.
- Electron empaquetado.
- Capacitor build nativo.
- CRM completo.
- Cambios nuevos de permisos.
- Nuevos contratos API.
- SQL/migraciones nuevas.
- Deploy a produccion.
