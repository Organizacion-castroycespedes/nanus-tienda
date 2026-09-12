# Evidencia — Gestión Operativa Phase 5

## Alcance

Phase 5 agrega una acción de reimpresión segura sobre el detalle de venta.
La acción usa la representación PDF existente de `backend-reporteria` y
solo se muestra cuando el documento electrónico está `ACCEPTED`.

## Seguridad de acciones

El detalle continúa protegido por `OperationalSaleScopeService` y por el
endpoint `GET /api/operations/sales/:saleId`. El frontend no decide el
alcance y no recibe credenciales, XML, SOAP ni payloads del proveedor.

La reimpresión es lectura de datos persistidos y no crea documentos,
outbox/inbox, intentos, estados ni CUFE. No llama FactuCore ni DIAN.

La acción `Actualizar datos` solo vuelve a cargar el detalle Manus. No se
presenta como refresh del proveedor.

## Decisiones pendientes

- `refreshDocumentStatus()` existe en el dominio de facturación, pero no
  existe todavía un endpoint seguro de Gestión Operativa que lo exponga sin
  mezclar contratos internos. Se mantiene diferido.
- `retryDocument()` puede invocar retry/transmisión del proveedor o emitir
  un documento si falta identidad. No se expone en UI.
- `REJECTED` y `ACCEPTED` no tienen retry operativo.
- Auditoría específica de acciones queda pendiente hasta reutilizar el flujo
  existente sin crear una tabla paralela.

## Validación

- La representación se abre con `getElectronicInvoice(saleId)` y
  `PdfPreviewModal`, reutilizando el stack de reportes existente.
- La condición de UI es `electronicBilling.status === "ACCEPTED"`.
- QA físico de impresora queda pendiente.
- No hubo llamadas FactuCore, DIAN, creación de documentos ni mutación QA.
