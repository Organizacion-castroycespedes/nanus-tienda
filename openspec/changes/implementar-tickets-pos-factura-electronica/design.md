# Diseño

El ticket POS existente continúa usando `SaleTicketInput` y `buildSaleTicketPayload`. La factura electrónica agrega `ElectronicInvoicePrintDataset`, exige `ACCEPTED` y `representationAvailable`, y genera un payload separado `ELECTRONIC_INVOICE` para `/printer/print-ticket`.

Los valores fiscales salen del endpoint `electronic-invoice-data`; el detalle de venta aporta únicamente líneas y pagos ya autorizados por reporteria. No se calcula CUFE, QR, número ni fechas. QR e imagen de logo requieren capacidad explícita del contrato del agente; mientras no exista, la operación falla cerrada o deja la representación PDF existente disponible.

La UI ofrece impresión FE solo en `ACCEPTED`. Reimpresión no llama FactuCore/DIAN ni muta la venta.
