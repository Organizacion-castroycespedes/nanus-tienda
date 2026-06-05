# Evidencia QA - POS Scanner MOCK - Fase 10

## Objetivo

Integrar lectura QR / codigo de barras MOCK en el POS usando `backend-perifericos` y los contratos web de Fase 6, sin hardware real.

Fase 10.1 agrega enriquecimiento del catalogo POS para que `GET /products?branchId=...` incluya codigos de barras activos y el scanner pueda matchear `46564567` sin hacer N requests por producto.

## Alcance

- Ruta objetivo: `http://localhost:3000/00000000-0000-0000-0000-000000000001/pos`.
- Consumo de eventos WebSocket `scanner.code.read`.
- Simulacion desde POS con `simulateScannerRead(input)`.
- Codigo especifico validado: `46564567`.
- Matching contra catalogo local ya cargado por POS.
- Feedback visual no bloqueante.
- Enriquecimiento backend de catalogo POS con `primaryBarcode`, `barcodeCodes` y `barcodes[]`.

Fuera de alcance:

- Scanner fisico real.
- USB, HID, serial, drivers, Electron o Capacitor.
- Cambios en inventario core, facturacion, `database/` o `backend-reporteria/`.

## Flujo POS identificado

- `PosScreen.tsx` carga catalogo con `getPosProducts(activeBranchId)`.
- El catalogo queda en `products`.
- El carrito usa `addToCart(product)`.
- La integracion scanner reutiliza `addToCart(product)` y no crea un flujo paralelo.
- El carrito se persiste por contexto POS en `localStorage` con keys `pos-cart:{tenantId}:{branchId}:{terminalId}:{userId}:{posSessionId}`.
- La venta no depende del scanner para confirmar ni persistir.

## Causa raiz Fase 10.1

- El codigo `46564567` existe en el modulo de codigos de barras del producto.
- Ese modulo usa `product_barcodes` y el endpoint `/products/:productId/barcodes`.
- El POS carga catalogo con `GET /products?branchId=...`.
- Antes de Fase 10.1, `ProductService.listProducts()` agregaba stock, pero no codigos de barras.
- Por eso el matcher de POS no podia ver `46564567` aunque existiera en inventario.

## Endpoint afectado

`GET /products?branchId=...`

Respuesta enriquecida:

```json
{
  "primaryBarcode": "46564567",
  "barcodeCodes": ["46564567"],
  "barcodes": [
    {
      "code": "46564567",
      "barcode": "46564567",
      "barcodeType": "UNIT",
      "isPrimary": true,
      "isActive": true
    }
  ]
}
```

La consulta de codigos usa una sola carga por `productIds` y filtra `is_active=true`. Productos sin codigos devuelven `primaryBarcode=null`, `barcodeCodes=[]` y `barcodes=[]`.

## Campos usados para busqueda por codigo

El matching es exacto y normalizado contra:

- `primaryBarcode`.
- `barcodeCodes[]`.
- `barcode` si existe en el payload de producto.
- `codigoBarras` si existe en el payload de producto.
- `codigo_barras` si existe en el payload de producto.
- `sku`.
- `reference` si existe en el payload de producto.
- `referencia` si existe en el payload de producto.
- `code` si existe en el payload de producto.
- `codigo` si existe en el payload de producto.
- `id`.
- `barcodes[].barcode`, `barcodes[].codigoBarras`, `barcodes[].codigo_barras`, `barcodes[].code`, `barcodes[].codigo` o `barcodes[].value` si existen y no estan inactivos.

## Caso especifico 46564567

- El panel `Scanner MOCK/SIMULATOR` abre con el input en `46564567`.
- El boton `Simular scanner` llama:

```json
{
  "terminalId": "local-terminal",
  "deviceId": "mock-scanner-001",
  "code": "46564567",
  "format": "CODE128"
}
```

- `backend-perifericos` emite `scanner.code.read`.
- `PosScreen` recibe el evento solo si esta montado.
- Si el catalogo local contiene un producto cuyo codigo coincide con `46564567`, reutiliza `addToCart(product)`.
- La logica actual de stock, precio, impuestos y pricing se conserva.
- Feedback esperado: `Producto agregado por scanner: 46564567`.

Resultado esperado:

- Si producto existe y `stock > 0`: encontrado y agregado al carrito.
- Si producto existe y `stock = 0`: encontrado, pero no agregado; se respeta warning actual `El producto no tiene stock disponible.`
- Si producto no llega en catalogo o codigo no coincide: `Código no encontrado: 46564567`.

## Codigo inexistente

- Codigo de prueba: `99999999`.
- Si no hay producto coincidente, el POS muestra `Código no encontrado: 99999999`.
- No crea producto.
- No modifica carrito.

## Comportamiento fuera de POS

Pregunta: ¿Que pasa si el usuario escanea el codigo de barras y no esta en la vista POS?

Respuesta: El evento no afecta el carrito porque la suscripcion vive solo en `PosScreen`. Si el usuario esta fuera de `/[tenant]/pos`, `PosScreen` esta desmontado, el WebSocket/listener se cierra y no hay accion de negocio. El evento puede quedar en `backend-perifericos`/logs o en `/admin/peripherals`, pero no agrega productos, no modifica carrito, no navega automaticamente y no abre POS.

## Archivos modificados

- `web/modules/pos/components/PosScreen.tsx`
- `web/domains/peripherals/contracts.ts`
- `web/domains/peripherals/README.md`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`

## Feature flags usadas

- `NEXT_PUBLIC_PERIPHERALS_ENABLED`
- `NEXT_PUBLIC_PERIPHERALS_SCANNER_ENABLED`

Comportamiento:

- Si alguna esta en `false`, el POS no abre WebSocket scanner.
- El panel de simulacion queda desactivado.
- No se muestran errores por scanner desactivado.

## Comportamiento offline

- Si falla WebSocket, la UI marca `Scanner MOCK` como desconectado.
- Si falla `simulateScannerRead()`, se muestra warning controlado.
- El POS sigue operando.
- No se muestran stack traces al usuario.

## Pruebas realizadas

- Codigo existente `46564567`: flujo implementado y validado por build. Smoke manual con datos reales de catalogo queda pendiente de entorno local con API principal, sesion POS y producto cargado.
- Codigo inexistente `99999999`: flujo implementado; muestra warning y no modifica carrito.
- Agent offline: manejado por error controlado de contrato y estado `Desconectado`.
- Cleanup: `subscribeScannerEvents()` devuelve unsubscribe y `PosScreen` lo ejecuta al desmontar.
- API: `ProductService.listProducts()` incluye `primaryBarcode`, `barcodeCodes` y `barcodes[]`.
- API: codigos inactivos quedan omitidos.
- API: productos sin codigos no rompen respuesta.
- API: codigos de todos los productos se cargan con una llamada por `productIds`, sin N+1 para barcodes.

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

## Resultado build/test api

Comandos:

```text
cd api
npm.cmd run build
npx.cmd tsx --test "src/**/*.spec.ts"
```

Resultado: PASS.

- Build TypeScript: PASS.
- Tests API: PASS, 360 pass, 1 skipped.
- Test enfocado `ProductService`: PASS, 21/21.

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

## Resultado OpenSpec validate

Comando:

```text
openspec.cmd validate add-pos-peripherals-platform --type change --strict
```

Resultado: PASS.

Salida:

```text
Change 'add-pos-peripherals-platform' is valid
```

## Resultado git diff --check

Comando:

```text
git diff --check
```

Resultado: PASS.

Notas:

- Sin errores de whitespace.
- Git reporto warnings de conversion LF -> CRLF en archivos ya modificados del working tree.

## Riesgos pendientes

- Smoke manual completo requiere backend principal, `backend-perifericos`, web, sesion POS y producto con stock disponible.
- Si el producto `46564567` esta sin stock, el POS debe encontrarlo, pero no agregarlo por la regla actual de stock.

## Restricciones cumplidas

- No se uso hardware real.
- No se uso USB real.
- No se uso HID real.
- No se instalaron drivers.
- No se activo adapter real.
- No se modifico `database/`.
- No se modifico `backend-reporteria/`.
- No se integro Electron.
- No se integro Capacitor.
- No se modifico inventario core ni facturacion.
