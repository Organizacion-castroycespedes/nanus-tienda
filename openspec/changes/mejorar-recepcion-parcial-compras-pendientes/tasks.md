## 1. Analysis

- [x] Revisar `PurchaseReceiveForm`.
- [x] Revisar contrato frontend `receivePurchase`.
- [x] Revisar backend `PurchaseService.receivePurchase`.
- [x] Confirmar que el backend ya valida pendientes y procesa solo items enviados.

## 2. OpenSpec

- [x] Crear change `mejorar-recepcion-parcial-compras-pendientes`.
- [x] Documentar propuesta y diseno.
- [x] Agregar delta spec de recepcion por cantidades pendientes.

## 3. Implementation

- [x] Filtrar lineas completas en el formulario de recepcion.
- [x] Mostrar cantidad pedida, recibida y pendiente por linea visible.
- [x] Enviar solo lineas con cantidad mayor a cero.
- [x] Bloquear cantidades negativas o mayores al pendiente.
- [x] Mostrar mensaje cuando no haya productos pendientes por recibir.
- [x] Mantener lote/vencimiento/ubicacion/costo solo para lineas recibidas.
- [x] Confirmar que backend permite recepcion parcial y no reprocesa lineas omitidas.

## 4. Tests

- [x] Agregar tests frontend de calculo de pendientes y payload visible.
- [x] Agregar tests backend de recepcion parcial multi-linea.
- [x] Ejecutar tests especificos.

## 5. Validation

- [x] `openspec.cmd validate mejorar-recepcion-parcial-compras-pendientes --type change --strict`
- [x] `openspec.cmd validate --all --strict`
- [x] `cd api && npm.cmd run build`
- [x] `cd web && npm.cmd run lint`
- [x] `cd web && npm.cmd run build`
- [x] `git diff --check`
- [x] QA manual documentado como pendiente de navegador.
