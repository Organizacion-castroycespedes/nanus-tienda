# Evidencia backend producto enriquecido - Fase 3.1

## Resumen

Resultado final: APROBADO.

Se implemento soporte backend en `api/` para producto enriquecido. El cambio queda limitado al modulo de productos y no toca frontend, `backend-reporteria`, compras, ventas POS, pedidos, lotes, FEFO, alertas, historial de precios ni funciones SQL criticas.

## Fecha/hora

- Fecha/hora local: `2026-05-28 00:33:43 -05:00`
- Ambiente de validacion: local/dev

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/entities/product.entity.ts` | Agrega tipos, defaults y validaciones de producto enriquecido. |
| `api/src/modules/inventory/controllers/product.controller.ts` | Extiende tipos de body sin cambiar rutas. |
| `api/src/modules/inventory/services/product.service.ts` | Agrega validaciones de negocio y defaults compatibles. |
| `api/src/modules/inventory/repositories/product.repository.ts` | Lee, inserta y actualiza columnas nuevas con queries parametrizadas. |
| `api/src/modules/inventory/services/product.service.spec.ts` | Agrega tests unitarios de reglas de producto enriquecido. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Marca Fase 3.1 completada. |

## Campos soportados

| API camelCase | Base de datos snake_case | Default |
| --- | --- | --- |
| `isPerishable` | `is_perishable` | `false` |
| `requiresLot` | `requires_lot` | `false` |
| `requiresExpiration` | `requires_expiration` | `false` |
| `operationalStatus` | `operational_status` | `ACTIVE` |
| `rotationClass` | `rotation_class` | `null` |
| `minStock` | `min_stock` | `null` |
| `maxStock` | `max_stock` | `null` |

Los campos existentes se mantienen:

- `id`
- `tenantId`
- `unitId`
- `taxId`
- `name`
- `description`
- `sku`
- `price`
- `cost`
- `priceWithTax`
- `priceWithoutTax`
- `isActive`
- `createdAt`
- `updatedAt`

## Validaciones implementadas

| Regla | Resultado |
| --- | --- |
| `requiresExpiration = true` exige `requiresLot = true` | Implementado en service y entity. |
| `isPerishable = true` exige `requiresLot = true` o `requiresExpiration = true` | Implementado en service y entity. |
| `minStock >= 0` si viene | Implementado. |
| `maxStock >= 0` si viene | Implementado. |
| `maxStock >= minStock` si ambos vienen | Implementado. |
| `operationalStatus` permitido | `ACTIVE`, `INACTIVE`, `BLOCKED`, `DISCONTINUED`. |
| `rotationClass` permitido | `HIGH`, `MEDIUM`, `LOW`, `NO_MOVEMENT` o `null`. |
| `price` y `cost` no negativos | Conservado y reforzado en update si vienen. |
| `sku` normalizado y unico por tenant | Conservado. |

## Compatibilidad

- No se cambiaron rutas de `ProductController`.
- `GET /api/products` mantiene `branchId` y calculo actual de stock.
- `GET /api/products/:id` mantiene busqueda por `tenantId`.
- `POST /api/products` acepta payload actual sin campos nuevos.
- `PUT /api/products/:id` mantiene todos los campos opcionales.
- `DELETE /api/products/:id` sigue haciendo baja logica con `is_active = false`.
- Las responses agregan campos nuevos sin eliminar campos existentes.

## Repositorio y seguridad SQL

- `SELECT` ahora incluye columnas nuevas.
- `INSERT` guarda columnas nuevas con defaults compatibles.
- `UPDATE` usa una lista blanca fija de columnas y parametros `$n`.
- No hay string interpolation con valores de usuario.
- No se cambio calculo de stock.

## Tests ejecutados

Comando:

```text
cmd /c npx tsx --test src/modules/inventory/services/product.service.spec.ts
```

Resultado:

```text
tests 7
suites 1
pass 7
fail 0
duration_ms 14223.4204
```

Casos cubiertos:

- Crear producto sin campos nuevos aplica defaults.
- Crear producto perecedero sin lote ni vencimiento falla.
- Crear producto con vencimiento sin lote falla.
- Crear producto con `minStock` negativo falla.
- Crear producto con `maxStock < minStock` falla.
- Actualizar con `operationalStatus` invalido falla.
- Actualizar con `rotationClass` invalido falla.

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

## Validaciones OpenSpec y formato

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
      "durationMs": 11
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

## Validaciones manuales

- Se reviso que no hay cambios en `web/`.
- Se reviso que no hay cambios en `backend-reporteria/`.
- Se reviso que no hay cambios en funciones SQL criticas.
- Se reviso que no hay cambios en compras, ventas POS, pedidos, lotes, FEFO, alertas ni historial de precios funcional.

## Riesgos vivos

RIESGO: No hay `ValidationPipe` global confirmado para validar DTOs por decorators; por eso las reglas viven en `ProductService`.

RIESGO: Esta fase no implementa barcodes, lotes, FEFO, historial de precios ni alertas, aunque las tablas ya existen.

RIESGO: La compatibilidad HTTP fue validada por no cambiar rutas/firmas y por build/tests unitarios; no se ejecuto prueba e2e con servidor levantado.

## Proximos pasos

1. Implementar barcodes en una fase separada.
2. Implementar historial de precios con motivo obligatorio en una fase separada.
3. Integrar lotes y FEFO solo despues de pruebas especificas de POS/compras/pedidos.
4. Definir si se agregara `ValidationPipe` global o DTOs con validacion activa en otra fase.
