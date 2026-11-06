## Why

El formulario de productos permite a `ADMIN` crear y editar productos, pero una condicion local excluye ese rol de la configuracion fiscal avanzada aunque el backend ya autoriza `INVENTORY_PRODUCTS:WRITE`. La diferencia oculta campos, omite validaciones y elimina `taxId`/`taxes` del payload de creacion o edicion, contradiciendo el modelo operativo aprobado para catalogos del tenant.

## What Changes

- Permitir que un `ADMIN` con capacidad efectiva de escritura de productos use la misma configuracion fiscal avanzada disponible para `SUPER_USER` y `SUPER_ADMIN`.
- Mantener una sola capacidad central en `ProductForm` para render, validacion y construccion del payload fiscal.
- Cubrir creacion y edicion de categoria fiscal, precio DANE, vigencias y asignaciones de impuestos sin borrar configuracion existente accidentalmente.
- Mantener `USER` y roles no autorizados fuera de la configuracion fiscal avanzada.
- Preservar el aislamiento por tenant y los contratos/backend actuales; no cambiar RBAC global, calculos IVA/ICL/ADV, POS, FactuCore, base de datos ni endpoints.
- Agregar pruebas focalizadas de la matriz de roles, render, validacion y payload, mas un plan de QA manual sin emision fiscal real.

## Capabilities

### New Capabilities

- `product-fiscal-administration`: autorizacion y comportamiento del formulario para administrar parametros fiscales avanzados de productos por rol y tenant.

### Modified Capabilities

Ninguna.

## Impact

- Frontend: `web/modules/inventory/components/ProductForm.tsx` y pruebas focalizadas del formulario/capacidad fiscal.
- Gobernanza: nuevo OpenSpec y asociacion exacta de los archivos tecnicos tocados en `scripts/governance/openspec-scope.json`.
- Backend, base de datos, endpoints, contratos, permisos globales y calculos fiscales: sin cambios.
- Compatibilidad: `SUPER_USER` y `SUPER_ADMIN` conservan el comportamiento existente; `USER` continua sin acceso; los productos y asignaciones fiscales existentes se preservan.
