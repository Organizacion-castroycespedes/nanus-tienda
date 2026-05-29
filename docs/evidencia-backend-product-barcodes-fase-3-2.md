# Evidencia backend product barcodes - Fase 3.2

## Resumen

Resultado final: APROBADO.

Se implemento soporte backend en `api/` para multiples codigos de barras por producto. El cambio queda limitado al modulo de inventario/productos/barcodes.

No se modifico `web/`, `backend-reporteria/`, POS, compras, pedidos, lotes, FEFO, alertas, historial de precios, migraciones, seeds ni funciones SQL criticas.

## Fecha/hora

- Fecha/hora local: `2026-05-28 00:45:37 -05:00`
- Ambiente de validacion: local/dev

## Archivos creados/modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/entities/product-barcode.entity.ts` | Entity y tipos permitidos de barcode. |
| `api/src/modules/inventory/repositories/product-barcode.repository.ts` | Acceso parametrizado a `product_barcodes`. |
| `api/src/modules/inventory/services/product-barcode.service.ts` | Reglas de negocio y transacciones para primary. |
| `api/src/modules/inventory/controllers/product-barcode.controller.ts` | Endpoints REST bajo productos. |
| `api/src/modules/inventory/inventory.module.ts` | Registro de controller, service y repository. |
| `api/src/modules/inventory/services/product-barcode.service.spec.ts` | Tests unitarios de reglas de barcodes. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Marca Fase 3.2 completada. |

## Endpoints agregados

| Metodo | Ruta | Permiso |
| --- | --- | --- |
| `GET` | `/api/products/:productId/barcodes` | `INVENTORY_PRODUCTS` READ |
| `POST` | `/api/products/:productId/barcodes` | `INVENTORY_PRODUCTS` WRITE |
| `PUT` | `/api/products/:productId/barcodes/:barcodeId` | `INVENTORY_PRODUCTS` WRITE |
| `PATCH` | `/api/products/:productId/barcodes/:barcodeId/deactivate` | `INVENTORY_PRODUCTS` WRITE |
| `PATCH` | `/api/products/:productId/barcodes/:barcodeId/set-primary` | `INVENTORY_PRODUCTS` WRITE |

No se cambiaron rutas existentes de productos.

## Modelo soportado

Campos expuestos en camelCase:

- `id`
- `tenantId`
- `productId`
- `barcode`
- `barcodeType`
- `isPrimary`
- `isActive`
- `createdAt`
- `updatedAt`

Tipos permitidos para `barcodeType`:

- `UNIT`
- `PACKAGE`
- `BOX`
- `SUPPLIER`
- `INTERNAL`
- `OTHER`

## Reglas implementadas

| Regla | Resultado |
| --- | --- |
| `barcode` requerido, trim y no vacio | Implementado. |
| `barcodeType` default `UNIT` | Implementado. |
| `barcodeType` validado contra lista permitida | Implementado. |
| `productId` debe existir en el tenant | Implementado con `ProductRepository.findById`. |
| Barcode activo no puede repetirse dentro del tenant | Implementado en service. |
| Mismo barcode en otro tenant permitido a nivel service | Implementado. |
| Crear primary desmarca otros primarios activos del producto | Implementado con transaccion. |
| Set primary desmarca otros primarios activos del producto | Implementado con transaccion. |
| Barcode inactivo no puede marcarse primary | Implementado. |
| Deactivate no borra fisicamente | Implementado. |
| Inactivar primary no reasigna automaticamente | Implementado. |
| No modifica `products.sku` | Respetado. |

## SQL y seguridad

- Todas las queries usan parametros `$n`.
- `UPDATE` usa lista blanca fija de columnas.
- Toda operacion filtra por `tenant_id`.
- Operaciones de primary usan `BEGIN` / `COMMIT` / `ROLLBACK`.
- No hay string interpolation con valores de usuario.

## Tests ejecutados

Comando especifico:

```text
cmd /c npx tsx --test src/modules/inventory/services/product-barcode.service.spec.ts
```

Resultado:

```text
tests 11
suites 1
pass 11
fail 0
```

Comando combinado:

```text
cmd /c npx tsx --test src/modules/inventory/services/product.service.spec.ts src/modules/inventory/services/product-barcode.service.spec.ts
```

Resultado:

```text
tests 18
suites 2
pass 18
fail 0
```

Casos cubiertos:

- Crear barcode `UNIT` default.
- Crear barcode primary desmarca otros.
- Rechazar barcode vacio.
- Rechazar `barcodeType` invalido.
- Rechazar barcode activo duplicado en mismo tenant.
- Permitir mismo barcode en otro tenant a nivel service.
- Rechazar barcode para producto de otro tenant.
- Actualizar barcode valido.
- Rechazar update a barcode duplicado.
- Inactivar barcode.
- Rechazar set primary si barcode esta inactivo.

## Build ejecutado

Comando:

```text
cmd /c npm run build
```

Resultado:

```text
> @soft-metal-glass/api@0.1.0 build
> tsc -p tsconfig.json
```

Exit code: `0`.

## Validaciones finales

Comando:

```text
cmd /c openspec validate fortalecer-productos-inventario --type change --strict --json
```

Resultado:

```json
{
  "items": [
    {
      "id": "fortalecer-productos-inventario",
      "type": "change",
      "valid": true,
      "issues": [],
      "durationMs": 5
    }
  ],
  "summary": {
    "totals": {
      "items": 1,
      "passed": 1,
      "failed": 0
    }
  }
}
```

Comando:

```text
git diff --check
```

Resultado:

- Exit code: `0`
- Sin errores de whitespace.
- Git mostro warnings de CRLF esperados en archivos TypeScript existentes.

## Compatibilidad

- `GET /api/products` no cambia.
- `POST /api/products` no cambia.
- `PUT /api/products/:id` no cambia.
- `DELETE /api/products/:id` no cambia.
- POS no cambia.
- Compras no cambia.
- Pedidos no cambia.
- Reporteria no cambia.
- `products.sku` no cambia.

## Riesgos vivos

RIESGO: La base tiene unique `(tenant_id, barcode)`, no solo para activos. El service evita duplicados activos, pero la BD tambien impedira reutilizar un barcode inactivo dentro del mismo tenant.

RIESGO: No hay prueba HTTP e2e con servidor levantado; se valido con build y tests unitarios.

RIESGO: No se implementa busqueda POS por barcode en esta fase.

RIESGO: No se integra barcode en frontend en esta fase.

## Proximos pasos

1. Agregar UI para gestionar barcodes por producto.
2. Definir busqueda por barcode en catalogo/POS en fase separada.
3. Decidir si se mantiene unique total `(tenant_id, barcode)` o se migra a unique parcial solo activos.
4. Agregar pruebas e2e HTTP cuando exista harness.
