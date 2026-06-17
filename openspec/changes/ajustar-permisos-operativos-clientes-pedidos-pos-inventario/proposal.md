## Why

El recorrido manual detecto que permisos administrativos de Inventario estan mezclados con lecturas operativas usadas por Clientes, Pedidos y POS. Esto bloquea flujos de venta para `USER` en QA y a la vez expone Inventario administrativo donde no corresponde.

## What Changes

- Separar lectura operativa de clientes, productos e impuestos de la visibilidad/gestion administrativa de Inventario.
- Permitir crear y editar clientes a `USER`, `ADMIN`, `SUPER_USER` y `SUPER_ADMIN` cuando el flujo operativo lo requiere.
- Cubrir los endpoints fiscales `electronic-invoicing/customers` que la pantalla real de `/customers` usa para listar, crear y editar datos fiscales basicos.
- Permitir que `USER` consulte clientes, productos e impuestos necesarios para Orders/POS sin permisos administrativos de Inventario.
- Permitir que POS/Orders calcule `pricing/preview-line` para roles operativos sin abrir administracion de promociones.
- Ocultar y bloquear `/inventory` y submenus administrativos para `USER`.
- Mantener Roles solo para `SUPER_ADMIN`.
- Mantener Terminales solo para `SUPER_USER` y `SUPER_ADMIN`.
- Ajustar seeds/migraciones idempotentes para corregir `role_menu_permissions` del tenant operativo sin tocar QA ni produccion.

## Capabilities

### New Capabilities
- `operational-role-permissions`: Reglas de permisos operativos para Clientes, Orders, POS, menu dinamico y rutas administrativas.

### Modified Capabilities
- `access-role-audit`: La matriz de auditoria debe reflejar que `USER` conserva lecturas operativas pero no acceso administrativo de Inventario.

## Impact

- Backend NestJS: controllers, decorators/guards y tests para `customers`, `electronic-invoicing/customers`, `pricing/preview-line`, `products`, `taxes`, roles y terminales.
- Frontend Next.js: permisos de rutas, menu/sidebar, permisos de accion en Customers/Orders/POS e infraestructura de tests.
- SQL: scripts idempotentes de menu/permisos para retirar Inventario administrativo de `USER` y conservar permisos operativos.
- Documentacion: evidencia tecnica sin secretos, tokens, cookies ni passwords.
