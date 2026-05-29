# Evidencia flag inventory_create_sale_v2 - Fase 3.13

Fecha: 2026-05-28

Ambiente: desarrollo local. No se ejecutaron ventas reales.

## Objetivo

Preparar `api/` para seleccionar `inventory_create_sale` v1 o `inventory_create_sale_v2` mediante flag interno, manteniendo v1 como default y sin cambiar contratos de API.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/repositories/sale.repository.ts` | Agrega helper privado para resolver funcion SQL de venta POS por flag. |
| `api/src/modules/inventory/repositories/sale.repository.spec.ts` | Agrega tests unitarios de seleccion v1/v2 y compatibilidad de payload/respuesta. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Marca Fase 3.13 como completada. |
| `docs/evidencia-flag-inventory-create-sale-v2-fase-3-13.md` | Evidencia tecnica de esta fase. |

## Flag

| Campo | Valor |
| --- | --- |
| Nombre | `INVENTORY_SALE_V2_ENABLED` |
| Default | `false` |
| Valor que activa v2 | `true` exacto |
| Cualquier otro valor | usa `inventory_create_sale` v1 |

SUPUESTO: No hay helper central de env para flags operativos en este modulo, por eso se usa comparacion estricta simple contra `process.env.INVENTORY_SALE_V2_ENABLED === "true"`.

## Comportamiento implementado

- Sin `INVENTORY_SALE_V2_ENABLED`, `SaleRepository` llama `inventory_create_sale`.
- Con `INVENTORY_SALE_V2_ENABLED=false`, llama `inventory_create_sale`.
- Con `INVENTORY_SALE_V2_ENABLED=true`, llama `inventory_create_sale_v2`.
- Con valor inesperado como `TRUE`, llama `inventory_create_sale`.
- El nombre de funcion SQL se restringe a una union interna cerrada: `inventory_create_sale` o `inventory_create_sale_v2`.
- El payload enviado a la funcion se mantiene igual.
- La respuesta esperada se mantiene igual.
- Se registra en debug la funcion usada, sin datos sensibles.

## Confirmaciones

| Control | Resultado |
| --- | --- |
| v1 sigue default | OK |
| v2 solo con flag `true` | OK |
| No cambia firma publica de `SaleRepository.createSaleWithFunction` | OK |
| No cambia contrato API | OK |
| No se modifico `SaleService` | OK |
| No se modifico `SaleController` | OK |
| No se modifico POS frontend | OK |
| No se modifico `web/` | OK |
| No se modifico `backend-reporteria/` | OK |
| No se modificaron funciones SQL | OK |
| No se crearon migraciones | OK |
| No se ejecutaron ventas reales | OK |

## Comandos ejecutados

```powershell
cmd /c npx tsx --test src/modules/inventory/repositories/sale.repository.spec.ts
```

Resultado:

```text
tests 4
pass 4
fail 0
```

```powershell
cmd /c npm run build
```

Resultado:

```text
tsc -p tsconfig.json
OK
```

```powershell
cmd /c openspec validate fortalecer-productos-inventario --type change --strict --json
```

Resultado:

```json
{"valid": true}
```

```powershell
git diff --check
```

Resultado:

```text
OK con warnings CRLF existentes en archivos previos.
```

## Riesgos vivos

- RIESGO: `inventory_create_sale_v2` puede activarse por env solo en ambientes donde la migracion 3.12 ya fue aplicada.
- RIESGO: No se probaron ventas reales ni fixtures loteados en esta fase.
- RIESGO: Cancelacion loteada sigue pendiente.
- RIESGO: Productos `requires_lot=true` con stock legacy sin `inventory_lot_balances` fallaran cuando v2 se active.
- RIESGO: El flag es global de proceso; flag por tenant/sucursal queda para fase futura.

## Proximos pasos

1. Crear pruebas controladas de venta POS loteada con fixtures locales.
2. Validar v2 con productos no loteados, loteados y venta mixta.
3. Definir estrategia de activacion por tenant/sucursal.
4. Implementar cancelacion loteada antes de activar v2 en operacion real.
