# Evidencia — dashboard de Gestión Operativa

## Alcance

`GET /api/operations/dashboard` es una lectura agregada. Reusa
`OperationalSaleScopeService`: USER queda limitado a su turno OPEN actual;
ADMIN a sucursales autorizadas; SUPER_USER a sucursales activas del tenant;
SUPER_ADMIN conserva la política global existente. `branchId` solo reduce el
alcance ya resuelto.

## Fórmulas

- `totalSalesCount`, `totalSalesAmount` y `averageTicket` salen de `sales`.
- Los estados FE usan un único `electronic_documents` actual por venta, para
  no contar duplicados de reintentos.
- `electronicAcceptanceRate` = documentos actuales ACCEPTED / documentos
  electrónicos actuales. Denominador cero devuelve `0`.
- `documentsRequiringAttention` cuenta REJECTED, TECHNICAL_ERROR y
  MANUAL_REVIEW.
- La tendencia agrupa por día y mantiene separados ventas y documentos FE.

## UI y QA manual pendiente

`/{tenant}/operations` es el dashboard. `/{tenant}/operations/sales` es la
lista dedicada. Hay selector de periodo, selector de sucursal solo cuando
corresponde, estados de carga/error/sin datos y enlaces a ventas filtradas.

Pendiente: captura y validación visual en desktop POS, tablet y Electron con
datos QA autorizados. Este cambio no ejecuta migraciones, seeds, FactuCore,
DIAN ni workers.

## Smoke runtime

Fecha: 2026-09-12. El health endpoint QA respondió `200`, pero el despliegue
QA actual respondió `404` para `GET /api/operations/dashboard`. El conector
de navegador no encontró una sesión utilizable. Por eso no se intentó login,
no se consultaron métricas, y no se fabricaron valores. La certificación con
datos QA queda `BLOCKED` hasta desplegar esta rama y adjuntar un contexto de
navegador autenticado.

Mutaciones QA: 0. Mutaciones PROD: 0. Llamadas FactuCore: 0. Llamadas DIAN:
0. Workers: deshabilitados.

## ImpresiÃ³n FE

El endpoint de reportes proyecta el snapshot inmutable de cliente desde
`metadata.electronicBilling.customer` y lÃ­neas reales desde
`electronic_document_taxes`. La impresiÃ³n no usa el cliente maestro actual ni
calcula impuestos desde diferencias del total. El builder exige estado
`ACCEPTED`, nÃºmero y un QR autoritativo; sin QR, falla con mensaje controlado.

Gap conocido: este repositorio contiene el cliente Electron, pero no contiene
la implementaciÃ³n del Peripheral Agent ESC/POS. No se inventÃ³ un protocolo de
imagen o QR. Logo y QR quedan pendientes hasta integrar primitivas soportadas
por el Agent.

Checklist fÃ­sico pendiente para impresora 80 mm: logo centrado y legible,
contraste, descripciones largas, cantidades decimales, cÃ³digos, totales,
impuestos por tasa, CUFE completo, QR escaneable, acentos, ausencia de
recorte, alimentaciÃ³n y corte. Repetir en 58 mm si el perfil lo soporta.
