# Evidencia backend cambio de precio - Fase 6.1

## Objetivo

Endurecer el cambio de precio con historial.

El hueco cerrado fue: `PUT /api/products/:id` podia recibir `price`, `priceWithTax` o `priceWithoutTax` y actualizar precio sin pasar por `/change-price`.

## Alcance aplicado

- No se creo migracion nueva.
- `product_price_history` ya existe en `scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql`.
- No se tocaron POS, Orders, ventas, pedidos, funciones SQL de venta, reporteria ni migraciones.
- No se tocaron facturacion electronica, DIAN, GetAcquirer, suppliers fiscales, promociones ni `PricingService`.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/dto/change-product-price.dto.ts` | Nuevo DTO con `class-validator` para `newPrice` y `reason`. |
| `api/src/modules/inventory/controllers/product.controller.ts` | `POST /api/products/:id/change-price` usa `ChangeProductPriceDto` con `ValidationPipe` local. |
| `api/src/modules/inventory/services/product.service.ts` | `updateProduct` bloquea cambios directos de campos de precio. |
| `api/src/modules/inventory/services/product.service.spec.ts` | Agrega pruebas de hardening de precio y mantiene pruebas de historial. |
| `web/modules/inventory/components/ProductForm.tsx` | Cambio minimo: en modo edicion no envia `price`, `priceWithTax` ni `priceWithoutTax`; el campo precio queda deshabilitado y remite a `Cambiar precio`. |

## Validaciones de DTO

`ChangeProductPriceDto` valida:

- `newPrice` obligatorio.
- `newPrice` numerico.
- `newPrice >= 0`.
- `reason` obligatorio.
- `reason` minimo 5 caracteres.

El servicio conserva validacion defensiva con `trim()` para bloquear motivos vacios como `"   "`.

## Regla endurecida

`ProductService.updateProduct` rechaza payloads con cualquiera de estos campos:

- `price`
- `priceWithTax`
- `priceWithoutTax`
- `price_with_tax`
- `price_without_tax`

Error controlado:

```text
price updates must use /products/:id/change-price; blocked fields: ...
```

## Endpoints vigentes

### `POST /api/products/:id/change-price`

Sigue siendo la unica via autorizada para cambiar precio vigente con historial:

```json
{
  "newPrice": 12000,
  "reason": "Ajuste por nuevo costo de proveedor"
}
```

### `GET /api/products/:id/price-history`

Consulta historial del producto filtrado por tenant autenticado.

## Pruebas ejecutadas

```bash
cd api && npx.cmd tsx --test src/modules/inventory/services/product.service.spec.ts
```

Resultado:

- 18 tests pasan.
- 0 fallos.

Cobertura relevante:

- `changePrice` registra historial aplicado.
- `changePrice` valida motivo obligatorio y minimo.
- `changePrice` rechaza precio negativo.
- `updateProduct` rechaza `price`.
- `updateProduct` rechaza `priceWithTax`.
- `updateProduct` rechaza `priceWithoutTax`.
- `updateProduct` rechaza `price_with_tax`.
- `updateProduct` rechaza `price_without_tax`.
- `updateProduct` sin campos de precio funciona.
- No se tocan `sale_items` ni `order_items`.

## Validaciones ejecutadas

```bash
cd api && npm.cmd run build
```

Resultado: build pasa.

```bash
openspec.cmd validate fortalecer-productos-inventario --type change --strict --json
```

Resultado: `valid = true`.

```bash
git diff --check
```

Resultado: pasa. Git mostro solo warnings de normalizacion LF/CRLF.

## Riesgos o pendientes

- El frontend se ajusto solo para no romper edicion de producto despues del bloqueo backend. No se ejecuto build de `web` porque la validacion autorizada fue build de `api`.
- `priceWithTax` y `priceWithoutTax` quedan protegidos contra update general. Cualquier recalculo fiscal futuro debe pasar por una fase especifica.
