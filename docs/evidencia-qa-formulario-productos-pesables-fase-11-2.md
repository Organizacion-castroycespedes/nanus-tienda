# Evidencia QA - Fase 11.2 - Formulario productos pesables

## Objetivo

Validar que la configuracion formal de productos pesables esta disponible en
creacion, edicion, API, catalogo POS y deteccion de productos pesables.

## Alcance

- Ruta funcional revisada: `/[tenant]/inventory/products`.
- API revisada: `GET /products?branchId=...`, `GET /products/:id`, create y update de productos.
- POS revisado: catalogo POS y helper de producto pesable.
- No se conecto hardware real.
- No se uso USB, serial, HID ni drivers.
- No se activo ningun adapter real.
- No se modifico `backend-reporteria/`.

## Archivos modificados o verificados

- `api/src/modules/inventory/entities/product.entity.ts`
- `api/src/modules/inventory/repositories/product.repository.ts`
- `api/src/modules/inventory/services/product.service.ts`
- `api/src/modules/inventory/services/product.service.spec.ts`
- `api/src/modules/inventory/controllers/product.controller.ts`
- `scripts/database/migrations/V053__products_sale_model_phase_11_1.sql`
- `web/domains/products/dtos.ts`
- `web/modules/inventory/services/product.service.ts`
- `web/modules/inventory/components/ProductForm.tsx`
- `web/app/[tenant]/inventory/products/page.tsx`
- `web/modules/pos/components/PosScreen.tsx`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`

## Formulario crear producto

Validacion por codigo:

- `ProductForm.tsx` define defaults `saleType=UNIT` y `measurementUnit=UND`.
- El formulario muestra selector `Modelo de venta`.
- El formulario muestra selector `Unidad comercial`.
- Al seleccionar `UNIT`, la unidad queda forzada a `UND`.
- Al seleccionar `WEIGHT` o `BOTH`, `UND` queda deshabilitada y el fallback es `KG`.
- El payload enviado a create incluye `saleType` y `measurementUnit`.

## Formulario editar producto

Validacion por codigo:

- `createInitialValues(product)` carga `product.saleType` y `product.measurementUnit`.
- El update envia `saleType` y `measurementUnit`.
- El update no envia precio directo en modo edicion; mantiene la regla existente de cambio de precio controlado.

## Casos QA

| Caso | Entrada | Resultado |
| --- | --- | --- |
| Crear producto unitario | `UNIT/UND` | Pasa. Defaults compatibles cubiertos por test API. POS lo trata como no pesable. |
| Crear producto pesable | `WEIGHT/KG` | Pasa. Test API confirma create y respuesta. POS lo trata como pesable. |
| Crear producto ambos | `BOTH/KG` | Pasa. Test API confirma create y respuesta. POS lo trata como pesable y mantiene venta unitaria disponible. |
| Editar producto | `UNIT/UND` a `WEIGHT/KG` | Pasa. Test API confirma update sin tocar precio. |
| Defaults | Sin tocar campos nuevos | Pasa. Test API confirma `UNIT/UND`. |

## Resultados API

- `createProduct()` persiste y devuelve `saleType` y `measurementUnit`.
- `updateProduct()` persiste y devuelve `saleType` y `measurementUnit`.
- `getProductById()` devuelve `saleType` y `measurementUnit`.
- `listProducts()` devuelve `saleType` y `measurementUnit` para el catalogo POS.
- `listProducts()` mantiene barcodes activos para scanner POS y evita N+1 con una consulta por lote de productos.

## Resultados POS

- `GET /products?branchId=...` entrega `saleType` y `measurementUnit` al catalogo POS.
- `PosScreen.tsx` usa `saleType` como fuente principal:
  - `UNIT`: no pesable.
  - `WEIGHT`: pesable.
  - `BOTH`: pesable y permite modo unitario.
- Si `saleType` no existe por compatibilidad legacy, el POS conserva fallbacks por unidad/campos historicos.

## Fixes aplicados en Fase 11.2

- Se agrego cobertura QA automatizada para:
  - crear `BOTH/KG`;
  - obtener producto por id con modelo formal;
  - listar productos con modelo formal para POS;
  - editar `saleType/measurementUnit` sin tocar precio.

No se agregaron migraciones nuevas en Fase 11.2.

## Comandos ejecutados

| Comando | Resultado |
| --- | --- |
| `cd api && npx.cmd tsx --test "src/**/*.spec.ts"` | PASS. 370 tests, 369 pass, 1 skipped. |
| `cd api && npm.cmd run build` | PASS. |
| `cd web && npm.cmd run build` | PASS. Warnings preexistentes de hooks/img. |
| `cd backend-perifericos && npm.cmd run build` | PASS. |
| `cd backend-perifericos && npm.cmd test` | PASS. 33 tests pass. |
| `cd web && npm.cmd test` | No ejecutado. `web/package.json` no define script `test`. |
| `openspec.cmd validate add-pos-peripherals-platform --type change --strict` | PASS. Change valid. |
| `git diff --check` | PASS. Solo warnings CRLF existentes. |
| `git status --short` | PASS ejecutado. Working tree dirty esperado por fases de perifericos y QA. |

## Smoke manual

No se ejecuto smoke manual en navegador en esta corrida. Para ejecutarlo se
requiere aplicar `V053__products_sale_model_phase_11_1.sql` en la DB local y
levantar API + Web. El runbook esperado:

1. Ir a `/00000000-0000-0000-0000-000000000001/inventory/products`.
2. Crear producto `UNIT/UND`.
3. Crear producto `WEIGHT/KG`.
4. Crear producto `BOTH/KG`.
5. Editar producto `UNIT/UND` a `WEIGHT/KG`.
6. Ir a `/00000000-0000-0000-0000-000000000001/pos`.
7. Confirmar que el catalogo recibe `saleType` y `measurementUnit`.
8. Probar balanza MOCK con producto `WEIGHT` si `backend-perifericos` esta levantado.

## Riesgos pendientes

- La validacion browser/DB real queda pendiente de aplicar migracion V053 en entorno local.
- `BOTH` usa `KG/LB/G/OZ` como unidad comercial en la UI actual; no permite `UND`, porque la regla backend exige unidad de peso para productos no `UNIT`.
- Warnings de build web son preexistentes y no bloquean esta fase.

## Restricciones cumplidas

- No hardware real.
- No USB real.
- No serial real.
- No HID real.
- No drivers.
- No Electron.
- No Capacitor.
- No backend-reporteria.
- No reglas fiscales.
- No reporterias.
- No avance a Fase 12.
