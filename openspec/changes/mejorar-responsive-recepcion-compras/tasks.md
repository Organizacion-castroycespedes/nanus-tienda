## 1. Analysis

- [x] Revisar ruta `/{tenantId}/purchases?action=receive`.
- [x] Revisar `PurchaseReceiveForm`.
- [x] Confirmar que el problema es visual/responsive y no de negocio.

## 2. Implementation

- [x] Ajustar wrapper principal con `w-full` y `min-w-0`.
- [x] Ajustar header de `Recibir compra` para mobile/desktop.
- [x] Ajustar resumen de compra con grid responsive.
- [x] Implementar scroll horizontal interno solo en productos.
- [x] Agregar ancho minimo interno para evitar columnas aplastadas.
- [x] Ajustar grid de lote/vencimiento/ubicacion/costo para no cortar campos.
- [x] Ajustar bloque `Confirmar recepcion`.
- [x] Ajustar botones inferiores para mobile y desktop.
- [x] No tocar backend, SQL, permisos ni calculos.

## 3. Validation

- [x] `openspec.cmd validate mejorar-responsive-recepcion-compras --type change --strict`
- [x] `openspec.cmd validate --all --strict`
- [x] `cd web && npm.cmd run build`
- [x] `cd web && npm.cmd run lint`
- [x] Tests web relacionados: no hay script `test` en `web/package.json`.
- [x] `git diff --check`
- [x] QA manual responsive PASS validado por usuario en navegador local.
