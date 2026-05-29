# Evidencia: frontend product barcodes - Fase 4.2

## Resumen

Se actualizo `web/` para administrar multiples codigos de barras por producto desde el modulo de productos.

SKU sigue siendo independiente. POS, escaner, ventas, compras, pedidos, reportes, SQL y backend no cambiaron.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `web/domains/products/dtos.ts` | Tipos `ProductBarcodeType` y `ProductBarcode`. |
| `web/modules/inventory/services/product.service.ts` | Cliente frontend para endpoints de barcodes. |
| `web/modules/inventory/components/ProductBarcodePanel.tsx` | Nuevo panel de administracion de codigos de barras. |
| `web/app/[tenant]/inventory/products/page.tsx` | Renderiza panel de barcodes al editar producto. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Tareas de Fase 4.2 registradas. |

## Endpoints consumidos

- `GET /api/products/:productId/barcodes`
- `POST /api/products/:productId/barcodes`
- `PUT /api/products/:productId/barcodes/:barcodeId`
- `PATCH /api/products/:productId/barcodes/:barcodeId/deactivate`
- `PATCH /api/products/:productId/barcodes/:barcodeId/set-primary`

## Componente agregado

`ProductBarcodePanel` se muestra al editar un producto existente.

Incluye:

- Listado de codigos.
- Tipo de codigo.
- Badge principal si/no.
- Badge activo/inactivo.
- Acciones: agregar, editar, inactivar, marcar principal.
- Estado vacio amigable para productos sin codigos.
- Confirmacion con `NoticeDialog` antes de inactivar.

## Validaciones UX

| Regla | Estado |
| --- | --- |
| `barcode` requerido | OK |
| `barcode` se envia con `trim()` | OK |
| `barcodeType` debe ser valido | OK |
| `barcodeType` default `UNIT` | OK |
| `isPrimary` opcional | OK |
| Al marcar principal muestra ayuda de reemplazo | OK |
| No permite guardar barcode vacio | OK |
| No marca principal desde UI si el codigo editado esta inactivo | OK |
| Errores backend se muestran al usuario | OK |

## Compatibilidad

- Crear/editar producto sigue funcionando.
- Listado de productos no cambia contrato.
- Productos sin barcodes muestran estado vacio.
- No se agrega busqueda por escaner.
- No se reemplaza SKU.
- No se toca POS.

## Comandos ejecutados

```powershell
cd web
cmd /c npx tsc --noEmit --pretty false
cmd /c "set CI=1&& npm run lint"
```

Build validado en copia temporal completa de `web/` para evitar conflicto con `.next` ocupado por servidores `next dev` existentes:

```powershell
npm run build
```

La copia temporal fue eliminada despues de validar.

## Resultado build/lint

| Validacion | Resultado |
| --- | --- |
| `npx tsc --noEmit --pretty false` | OK |
| `npm run build` en copia temporal completa | OK |
| `npm run lint` | Bloqueado: `next lint` entra en configuracion interactiva porque el proyecto no tiene config ESLint. |
| `openspec validate fortalecer-productos-inventario --type change --strict --json` | OK |
| `git diff --check` | OK |

## Validacion manual

Pendiente con API local y sesion autenticada:

- Editar producto existente.
- Ver panel `Codigos de barras`.
- Listar codigos existentes.
- Crear codigo `UNIT` default.
- Crear codigo principal y confirmar refresco.
- Editar codigo.
- Marcar codigo como principal.
- Inactivar codigo con confirmacion.
- Confirmar estado vacio en producto sin codigos.
- Confirmar error claro ante barcode duplicado.

## Confirmacion de alcance

| Area | Estado |
| --- | --- |
| `web/` | Modificado |
| `api/` | No modificado en esta fase |
| `backend-reporteria/` | No modificado |
| `scripts/database/` | No modificado |
| SQL/migraciones | No modificado |
| POS ventas | No modificado |
| Escaner POS | No implementado |
| Compras | No modificado |
| Pedidos | No modificado |
| Reportes | No modificado |

## Riesgos vivos

- Falta validacion manual con API real y token.
- `npm run lint` requiere configurar ESLint del proyecto.
- El build directo en el repo puede fallar si hay servidores `next dev` usando `.next` en Windows.
- POS aun no usa barcode ni escaner.
- No hay busqueda de producto por barcode en esta fase.

## Proximos pasos

1. Validar manualmente panel con API local.
2. Definir busqueda por barcode en POS/escanner en fase futura.
3. Evaluar mostrar barcode principal en tabla de productos si operacion lo solicita.
