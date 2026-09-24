# Inventario de modulos Web

Estado: B3 AS-IS. Solo se listan dominios y rutas demostrados por `web/`. Una
ruta no prueba que el flujo este completo o probado en QA.

| Area | Evidencia | Responsabilidad visible | Estado |
|---|---|---|---|
| Auth y navegacion | `web/domains/auth/`, `web/app/login/`, `web/app/[tenant]/layout.tsx` | Login, bootstrap, refresh, logout, menu y permisos visuales | Codigo confirmado; QA pendiente |
| Usuarios y roles | `web/app/[tenant]/usuarios/`, `roles/`, `web/domains/users/`, `roles/` | Administracion de identidad y RBAC | Codigo confirmado |
| Tenant, sucursal y ubicacion | `web/domains/tenants/`, `branches/`, `locations/` | Contexto tenant y catalogos operativos | Codigo confirmado |
| Menu y parametros | `web/domains/menu/`, `parameters/`, `web/app/[tenant]/configuracion/` | Menu, permisos y parametros | Codigo confirmado |
| Productos e inventario | `web/modules/inventory/`, `web/domains/products/`, `web/app/[tenant]/inventory/` | Productos, categorias, impuestos, unidades, lotes, existencias y ajustes | Codigo confirmado; profundidad pendiente |
| Compras y proveedores | `web/app/[tenant]/purchases/`, `web/modules/inventory/services/purchase*` | Compras y consultas relacionadas | Codigo confirmado |
| Pedidos y entregas | `web/app/[tenant]/orders/`, `deliveries/`, `web/modules/deliveries/` | Pedidos, domicilios, conductores y ticket | Codigo confirmado |
| Ventas operativas | `web/modules/operational-sales/`, `web/app/[tenant]/operations/sales/` | Consulta y detalle de ventas | Codigo confirmado |
| POS | `web/modules/pos/`, `web/domains/pos/`, `web/app/[tenant]/pos/` | Contexto, catalogo, carrito, venta e idempotencia | Codigo confirmado; flujo profundo pendiente |
| Caja y pagos | `web/modules/finance/`, `web/app/[tenant]/finance/` | Metodos de pago, cajas, sesiones y movimientos | Codigo confirmado |
| Promociones y precios | `web/modules/pricing/`, `web/modules/promotions/` | Precios y promociones | Codigo confirmado |
| Reporteria | `web/modules/reporteria/`, `web/app/[tenant]/reporteria/` | PDF, Excel, tickets y consultas | Cliente directo confirmado; ambiente pendiente |
| Facturacion electronica | `web/modules/electronic-invoicing/`, `fiscal-review/` | Perfiles, clientes y revision fiscal | UI/servicios presentes; DIAN productiva no certificada |
| Terminales | `web/modules/terminals/`, `web/app/[tenant]/config/terminals/` | Terminales y dispositivos | Codigo confirmado; sincronizacion Electron condicionada |
| Perifericos | `web/domains/peripherals/`, `web/app/[tenant]/admin/peripherals/` | Agent, bridge, impresion, cajon, scanner y bascula | Mock/configurado; hardware real pendiente |

Componentes transversales: `web/components/`, `web/store/`, `web/lib/http.ts`,
`web/lib/request.ts` y `web/app/providers.tsx`. No se encontro suite frontend
conectada en la inspeccion B3; no se ejecutaron pruebas.
