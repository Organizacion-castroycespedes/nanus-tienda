# Evidencia QA - POS Balanza MOCK - Fase 11

## Objetivo

Integrar lectura de peso MOCK en el POS usando `backend-perifericos` y los contratos web de Fase 6, sin balanza fisica real.

## Alcance

- Ruta objetivo: `http://localhost:3000/00000000-0000-0000-0000-000000000001/pos`.
- Lectura HTTP local mediante `readCurrentWeight(input?)`.
- Uso de peso estable como cantidad de producto pesable en el carrito.
- Feedback visual no bloqueante.
- Respeto de feature flags frontend.

Fuera de alcance:

- Balanza fisica real.
- USB, serialport, drivers, Electron o Capacitor.
- Cambios en inventario core, facturacion, persistencia, `database/` o `backend-reporteria/`.

## Flujo POS identificado

- `PosScreen.tsx` carga catalogo con `getPosProducts(activeBranchId)`.
- El carrito vive en `usePosCartStore()` y se mantiene en `cart`.
- Agregar producto usa `addToCart(product)`.
- Cantidad manual usa `updateQuantity(productId, nextQuantity)`.
- Recalculo de precio/promocion usa `queueCartItemPricing(...)` y `previewPosLinePrice(...)`.
- Fase 11 reutiliza ese mismo camino para aplicar peso como cantidad; no crea un segundo calculo de totales.

## Campos usados para detectar producto pesable

Helper creado en `PosScreen.tsx`: `isWeighableProduct(product)`.

Detecta como pesable si existe alguno de estos patrones:

- `product.isWeighable === true`
- `product.weighable === true`
- `product.soldByWeight === true`
- `product.measurementUnit` con `KG`, `kilo`, `kilogramo` o variantes.
- `product.unit` con `KG`, `kilo`, `kilogramo` o variantes.
- `product.unidad` con `KG`, `kilo`, `kilogramo` o variantes.
- `product.unitCode`, `unitName`, `unitSymbol` o `unitAbbreviation`.
- `product.productType`, `type` o `tipo` con `WEIGHABLE`, `pesable` o `por peso`.

## Comportamiento si no existe campo pesable formal

El catalogo actual no expone un campo formal obligatorio para producto pesable.

Por eso se implemento deteccion defensiva por aliases y unidad, sin migraciones y sin cambiar el modelo de producto. Si el backend no envia ningun alias pesable ni unidad `KG`, el POS no aplicara peso automaticamente y mostrara warning: `Selecciona un producto pesable antes de leer la balanza`.

Pendiente futuro: formalizar en el modelo de producto un campo unico como `isWeighable` o una unidad normalizada de venta.

## Archivos modificados

- `web/modules/pos/components/PosScreen.tsx`
- `web/domains/products/dtos.ts`
- `docs/evidencia-qa-pos-balanza-mock-fase-11.md`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`

## Integracion implementada

- Panel compacto `Balanza MOCK` dentro de POS.
- Estado visual: `Listo`, `Leyendo`, `Error` o `Desactivado por feature flag`.
- Boton `Leer balanza MOCK`.
- Ultimo peso leido visible.
- Ultimo resultado visible.
- Accion por item de carrito para productos detectados como pesables.
- Si no hay producto pesable en carrito, se muestra warning controlado.
- Si el peso es estable y mayor a cero, se aplica como cantidad con `setProductQuantityInCart(product, weight)`.
- Si el peso supera stock, se conserva warning actual de stock y no se aplica.
- Totales, impuestos y promociones se recalculan por la logica existente.

## Feature flags usadas

- `NEXT_PUBLIC_PERIPHERALS_ENABLED`
- `NEXT_PUBLIC_PERIPHERALS_SCALE_ENABLED`

Comportamiento:

- Si alguna esta en `false`, el boton de balanza queda deshabilitado.
- No se llama `backend-perifericos`.
- No se muestra error por balanza desactivada.

## Comportamiento offline

- `readCurrentWeight()` devuelve error controlado por contrato.
- Si el agent esta offline, la UI muestra `No se pudo leer la balanza MOCK`.
- El POS no se rompe.
- No se modifica carrito.
- No se muestran stack traces.

## Pruebas realizadas

- Helper `isWeighableProduct`: implementado con soporte para `KG`, flags booleanas y tipos `WEIGHABLE`/`pesable`.
- Peso estable: backend-perifericos test valida `GET /scale/current-weight`, respuesta mock y evento `scale.weight.changed`.
- Peso estable en POS: implementado para aplicar `1.25 kg` o el peso devuelto como cantidad si el producto es pesable y stock permite.
- Peso inestable: implementado para mostrar `Peso inestable, intenta nuevamente` y no modificar carrito.
- Peso `<= 0`: implementado para mostrar warning y no modificar carrito.
- Producto no pesable: implementado para mostrar warning y no modificar carrito.
- Feature flag false: implementado para deshabilitar accion y no llamar agent.
- Agent offline: implementado por contrato con warning controlado.

Smoke manual en navegador queda pendiente de entorno local con API principal, sesion POS activa y producto marcado como pesable en catalogo.

## Resultado build web

Comando:

```text
cd web
npm.cmd run build
```

Resultado: PASS.

Notas:

- Compilacion Next.js exitosa.
- Persisten warnings ESLint preexistentes en otras pantallas (`react-hooks/exhaustive-deps`, `@next/next/no-img-element`).
- `web/package.json` no tiene script `test`; no se ejecuto `npm.cmd test` en web.

## Resultado backend-perifericos build/test

Comandos:

```text
cd backend-perifericos
npm.cmd run build
npm.cmd test
```

Resultado: PASS.

- Build TypeScript: PASS.
- Tests: PASS, 33/33.
- Test relevante: `scale returns simulated weight and emits event`.

## Resultado OpenSpec validate

Comando:

```text
openspec.cmd validate add-pos-peripherals-platform --type change --strict
```

Resultado: PASS.

## Resultado git diff --check

Comando:

```text
git diff --check
```

Resultado: PASS.

## Riesgos pendientes

- Falta campo formal de producto pesable en catalogo.
- Si una unidad `KG` no llega al POS, el helper no puede detectar pesable.
- Smoke manual con UI real queda pendiente de datos locales y sesion POS.
- La cantidad decimal queda soportada por el carrito, pero la edicion manual actual del input sigue orientada a enteros.

## Restricciones cumplidas

- No hardware real.
- No USB real.
- No serialport real.
- No drivers.
- No Electron.
- No Capacitor.
- No `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No migraciones.
- No `database/`.
- No `backend-reporteria/`.
- No cambios en inventario core ni facturacion.
