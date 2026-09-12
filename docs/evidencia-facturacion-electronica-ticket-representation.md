# Evidencia: representación fiscal de factura electrónica

## Alcance

Se agregó un modelo tipado independiente del componente React y del motor de impresión para distinguir `ELECTRONIC_INVOICE_REPRESENTATION` de `SALE_RECEIPT`.

La representación aceptada usa únicamente datos persistidos: número fiscal, CUFE, fecha de emisión, fecha de aceptación, código/mensaje de respuesta, tracking, partes fiscales, líneas, impuestos, totales y medio de pago legible.

## Reglas

- Solo `ACCEPTED` puede construir la representación fiscal aceptada.
- `PENDING`, `PROCESSING`, `REJECTED`, `TECHNICAL_ERROR` y `CANCELLED` quedan bloqueados para esa representación.
- CUFE conserva su valor completo y usa cortes suaves para papel térmico.
- QR y `validation timestamp` siguen diferidos porque no están disponibles en el contrato actual.
- Reimpresión usa datos persistidos y no llama FactuCore ni DIAN.

## Validación

La prueba determinística cubre metadatos fiscales, ubicación `Colombia / Atlántico / Barranquilla`, pago `Efectivo`, bloqueo de estados no aceptados y wrapping de CUFE largo. No hubo llamadas externas ni mutación de QA.

La integración de recuperación automática/global y la prueba física de impresora quedan pendientes.
