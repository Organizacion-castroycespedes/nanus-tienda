## 1. Contrato y backend

- [x] 1.1 Centralizar la lista y comparacion de los seis campos estructurales en `ProductService`.
- [x] 1.2 Rechazar cambios reales antes de persistir y aceptar valores identicos para compatibilidad historica.
- [x] 1.3 Cubrir creacion, edicion comercial, seis rechazos estructurales, producto sin movimientos, valores identicos y aislamiento por tenant con pruebas unitarias.
- [x] 1.4 Verificar que importacion de productos reutiliza la proteccion central sin crear un bypass.

## 2. Experiencia web

- [x] 2.1 Mantener habilitados los controles estructurales durante la creacion.
- [x] 2.2 Deshabilitar unidad base, modelo de venta, unidad comercial, perecedero, lote y vencimiento durante la edicion.
- [x] 2.3 Mostrar una explicacion comprensible sobre la inmutabilidad despues del primer guardado.
- [x] 2.4 Agregar pruebas automatizadas para controles habilitados en creacion y bloqueados en edicion.

## 3. Reconciliacion separada

- [x] 3.1 Documentar evidencia read-only del movimiento inicial `33.000`, Kardex, vinculos y balances.
- [x] 3.2 Preparar SQL transaccional exacto con advisory lock, precondiciones, lote legacy separado y verificaciones finales, sin ejecutarlo.
- [x] 3.3 Mantener PENDING la intervencion hasta recibir codigo de lote, vencimiento real y autorizacion separada.

## 4. Validacion y entrega

- [x] 4.1 Ejecutar pruebas dirigidas de API y frontend.
- [x] 4.2 Ejecutar build de API, lint y build de web segun impacto.
- [x] 4.3 Ejecutar OpenSpec estricto, gobernanza del alcance y `git diff --check`.
- [x] 4.4 Confirmar que el staging previo conserva exactamente sus 11 archivos y que no se incluyeron secretos ni datos sensibles.
