# Evidencia QA - Modelo formal de productos pesables - Fase 11.1

## Objetivo

Definir formalmente cuando un producto se vende por unidad, por peso o por ambos modos, para que POS y balanza MOCK no dependan de inferencias ambiguas.

## Alcance

- API principal `api/`.
- Web inventory products y POS.
- Migracion SQL versionada.
- OpenSpec tasks.

Fuera de alcance:

- Balanza fisica real.
- USB, serialport, drivers, Electron o Capacitor.
- Cambios en reglas fiscales, reportes o backend-reporteria.

## Modelo formal

Campos agregados al producto:

- `saleType`: `UNIT`, `WEIGHT`, `BOTH`.
- `measurementUnit`: `UND`, `KG`, `LB`, `G`, `OZ`.

Reglas:

- `UNIT` usa `UND` y no usa balanza.
- `WEIGHT` usa `KG`, `LB`, `G` u `OZ` y usa balanza.
- `BOTH` usa `KG`, `LB`, `G` u `OZ`; POS permite unidad con click normal y peso con lectura de balanza.

Defaults compatibles:

- Productos existentes quedan como `saleType=UNIT`.
- Productos existentes quedan como `measurementUnit=UND`.

## Migracion SQL

Archivo:

- `scripts/database/migrations/V053__products_sale_model_phase_11_1.sql`

Contenido funcional:

- Agrega `products.sale_type`.
- Agrega `products.measurement_unit`.
- Define defaults `UNIT` y `UND`.
- Agrega constraints:
  - `chk_products_sale_type`.
  - `chk_products_measurement_unit`.
  - `chk_products_sale_model_measurement_unit`.
- Agrega indices por tenant para `sale_type` y `measurement_unit`.

La migracion es idempotente con `ADD COLUMN IF NOT EXISTS` y checks por `pg_constraint`.

## API

Archivos modificados:

- `api/src/modules/inventory/entities/product.entity.ts`
- `api/src/modules/inventory/repositories/product.repository.ts`
- `api/src/modules/inventory/services/product.service.ts`
- `api/src/modules/inventory/controllers/product.controller.ts`
- `api/src/modules/inventory/services/product.service.spec.ts`

Cambios:

- `ProductEntity` expone `saleType` y `measurementUnit`.
- `ProductRepository` lee, crea y actualiza `sale_type` y `measurement_unit`.
- `ProductService` valida modelo formal.
- `ProductController` acepta los campos en create/update.
- `GET /products?branchId=...` devuelve los campos porque el entity ya los incluye.

Tests agregados:

- Producto nuevo conserva defaults `UNIT/UND`.
- Producto `WEIGHT/KG` se crea correctamente.
- `saleType` invalido se rechaza.
- `measurementUnit` invalida se rechaza.
- `UNIT/KG` se rechaza.
- `WEIGHT/UND` se rechaza.

## Web

Archivos modificados:

- `web/domains/products/dtos.ts`
- `web/modules/inventory/services/product.service.ts`
- `web/modules/inventory/components/ProductForm.tsx`
- `web/app/[tenant]/inventory/products/page.tsx`
- `web/modules/pos/components/PosScreen.tsx`

Cambios:

- Tipos frontend `ProductSaleType` y `ProductMeasurementUnit`.
- Payload create/update incluye `saleType` y `measurementUnit`.
- Formulario de producto agrega selectores `Modelo de venta` y `Unidad comercial`.
- Listado de productos muestra columna `Venta` y badge de modelo.
- POS prefiere `product.saleType` sobre inferencias legacy.
- Fallback legacy por `KG`, `LB`, `G`, `OZ` queda solo si el catalogo no trae `saleType`.

## POS y balanza

Comportamiento:

- `UNIT`: click normal agrega `+1`; no usa balanza.
- `WEIGHT`: click de producto intenta leer `Balanza MOCK`; no agrega `+1`.
- `BOTH`: click normal agrega unidad; accion de balanza puede aplicar peso.
- El input de cantidad permite decimal para items pesables.
- El peso se sigue aplicando por la logica existente de carrito y pricing.

## Compatibilidad

- Productos existentes no se rompen por defaults.
- API mantiene endpoints existentes.
- POS actual sigue funcionando para productos `UNIT`.
- Scanner, impresora, caja y balanza MOCK no cambian contratos.
- No se toca hardware real.

## Comandos ejecutados

API:

```text
cd api
npm.cmd run build
npx.cmd tsx --test "src/**/*.spec.ts"
```

Web:

```text
cd web
npm.cmd run build
```

backend-perifericos:

```text
cd backend-perifericos
npm.cmd run build
npm.cmd test
```

OpenSpec y git:

```text
openspec.cmd validate add-pos-peripherals-platform --type change --strict
git diff --check
git status --short
```

## Resultados

- API build: PASS.
- API tests: PASS, 365 pass, 1 skipped.
- Web build: PASS.
- Web tests: no hay script `test` en `web/package.json`.
- backend-perifericos build: PASS.
- backend-perifericos tests: PASS, 33/33.
- OpenSpec validate: PASS.
- `git diff --check`: PASS con warnings CRLF del worktree.

## Riesgos pendientes

- La migracion debe aplicarse antes de arrancar API contra una DB que aun no tenga las columnas.
- `BOTH` tiene modo unidad por click y modo peso por balanza; una UI futura puede hacer seleccion explicita mas rica.
- La unidad comercial formal no reemplaza aun `unit_id`; conviven por compatibilidad.

## Restricciones cumplidas

- No hardware real.
- No USB real.
- No serialport real.
- No drivers.
- No Electron.
- No Capacitor.
- No cambios en reglas fiscales.
- No backend-reporteria.
- No reportes.
