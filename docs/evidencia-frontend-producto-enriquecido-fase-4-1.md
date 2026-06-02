# Evidencia: frontend producto enriquecido - Fase 4.1

## Resumen

Se actualizo `web/` para que el modulo de productos pueda visualizar, crear y editar campos de producto enriquecido ya soportados por `api/`.

Esta fase solo toco frontend, documentacion y OpenSpec. No se modifico `api/`, `backend-reporteria/`, SQL, migraciones, POS ventas, compras, pedidos ni reportes.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `web/domains/products/dtos.ts` | Tipos frontend para estado operativo, rotacion y campos enriquecidos. |
| `web/modules/inventory/services/product.service.ts` | Payload de crear/actualizar producto acepta campos enriquecidos opcionales. |
| `web/modules/inventory/components/ProductForm.tsx` | Nueva seccion `Configuracion operativa`, validaciones UX y payload enriquecido. |
| `web/app/[tenant]/inventory/products/page.tsx` | Badges discretos en listado de productos. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Tareas de Fase 4.1 registradas. |

## Campos agregados

- `isPerishable`
- `requiresLot`
- `requiresExpiration`
- `operationalStatus`
- `rotationClass`
- `minStock`
- `maxStock`

## Reglas UX implementadas

| Regla | Estado |
| --- | --- |
| `requiresExpiration=true` activa `requiresLot=true` automaticamente | OK |
| Apagar `requiresLot` apaga `requiresExpiration` | OK |
| Producto perecedero muestra ayuda visual | OK |
| Producto perecedero exige lote o vencimiento antes de enviar | OK |
| `minStock` no puede ser negativo | OK |
| `maxStock` no puede ser negativo | OK |
| `maxStock >= minStock` cuando ambos tienen valor | OK |
| Campos nuevos son opcionales con defaults compatibles | OK |
| Backend sigue siendo fuente final de validacion | OK |

## Componentes reutilizados

- `Button`
- `Input`
- `Select`
- Checkbox nativo con estilos existentes.
- Badges discretos inline con patron visual ya usado en tablas.

## Listado de productos

Se agregaron badges bajo el nombre del producto:

- `Perecedero`
- `Lote`
- `Vence`
- `Bloqueado`
- `Inactivo`
- `Descontinuado`
- `Alta rotacion`
- `Media`
- `Baja`
- `Sin movimiento`

Para no saturar tabla, el listado muestra maximo cuatro badges por producto.

## Compatibilidad

- Productos antiguos sin campos nuevos usan defaults seguros.
- Crear producto basico sigue enviando `isPerishable=false`, `requiresLot=false`, `requiresExpiration=false`, `operationalStatus=ACTIVE`, `rotationClass=null`, `minStock=null`, `maxStock=null`.
- Campos actuales `id`, `name`, `sku`, `price`, `cost`, `taxId`, `unitId`, `stock` e `isActive` no se eliminaron.
- La tabla conserva filtros existentes por texto, tenant y sucursal.
- No se modifico ajuste de stock.
- No se modifico POS.

## Comandos ejecutados

```powershell
cd web
npm run lint
npm run build
cmd /c npx tsc --noEmit --pretty false
```

Tambien se ejecuto un build aislado en copia temporal completa de `web/` porque el build directo en el repo encontro `.next` ocupado por servidores `next dev` existentes:

```powershell
npm run build
```

La copia temporal fue eliminada despues de validar.

## Resultado de validaciones

| Validacion | Resultado |
| --- | --- |
| `npm run lint` | Bloqueado por setup interactivo de Next: el proyecto no tiene config ESLint y `next lint` pide seleccionar modo. |
| `npm run build` en repo | Bloqueado por `EPERM` en `web\.next\trace`, causado por servidores `next dev` existentes usando `.next`. |
| `npx tsc --noEmit --pretty false` | OK |
| `npm run build` en copia temporal completa | OK |
| `openspec validate fortalecer-productos-inventario --type change --strict --json` | OK |
| `git diff --check` | OK |

## Validaciones manuales

Pendientes en navegador con sesion autenticada y API levantada:

- Abrir listado de productos.
- Crear producto basico sin campos nuevos.
- Crear producto perecedero con lote y vencimiento.
- Intentar `requiresExpiration=true` y `requiresLot=false`; la UI debe corregirlo.
- Intentar `minStock` negativo; la UI debe bloquear.
- Intentar `maxStock` menor que `minStock`; la UI debe bloquear.
- Editar producto existente y guardar.
- Confirmar badges en listado.

No se levanto API ni se usaron tokens para evitar tocar otros flujos en esta fase.

## Confirmacion de alcance

| Area | Estado |
| --- | --- |
| `web/` | Modificado |
| `api/` | No modificado |
| `backend-reporteria/` | No modificado |
| `scripts/database/` | No modificado |
| SQL/migraciones | No modificado |
| POS ventas | No modificado |
| Compras | No modificado |
| Pedidos | No modificado |
| Reportes | No modificado |
| Servidor/PRD real | No tocado |

## Riesgos vivos

- La validacion manual con usuario real queda pendiente.
- `npm run lint` requiere configurar ESLint del proyecto antes de ser usable en CI.
- El build directo sobre el repo puede fallar si hay servidores `next dev` usando `.next` en Windows.
- La UI de lotes, vencimientos por lote y ubicaciones aun no existe.
- Reporteria y tickets todavia no muestran lote.

## Proximos pasos

1. Ejecutar validacion manual con API local y usuario autenticado.
2. Extender compras web para capturar lote/vencimiento/ubicacion.
3. Crear vistas web de lotes, vencimientos y alertas.
4. Preparar reporteria de inventario cuando backend-reporteria entre en alcance.
