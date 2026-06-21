## Context

Electron Windows funciona como contenedor online y carga Manus POS Web. El analisis de perifericos definio que recibos deben iniciar por impresion web/Windows y que ESC/POS queda futuro.

El discovery del frontend muestra que ya existen flujos web de tickets PDF e impresion estandar:

| Archivo | Hallazgo |
| --- | --- |
| `web/modules/reporteria/components/PdfPreviewModal.tsx` | Imprime el iframe PDF con `contentWindow.print()`. |
| `web/app/[tenant]/finance/current-shift/page.tsx` | Abre ticket PDF en ventana y llama `printWindow.print()`. |
| `web/app/[tenant]/finance/cash-sessions/page.tsx` | Imprime ticket de cierre con `printWindow.print()`, incluso despues de cierre exitoso. |
| `web/app/[tenant]/purchases/page.tsx` | Muestra ticket PDF de compra en iframe y llama `contentWindow.print()`. |
| `web/domains/peripherals/README.md` | Documenta contratos contra `backend-perifericos` mock/local, no Electron. |

Por esto no se agrega una API Electron nueva en esta fase. El mejor primer paso es documentar que la app empaquetada Electron puede usar los flujos web existentes, porque el renderer sigue siendo Chromium.

## Goals / Non-Goals

**Goals:**

- Definir estrategia inicial con impresion web/Windows.
- Identificar flujos web existentes.
- Separar recibo operativo, ticket POS, factura, comprobante de caja y fiscal.
- Documentar limites para `webContents.print` futuro.
- Mantener seguridad Electron.
- Documentar QA manual y estados posibles.

**Non-Goals:**

- No implementar APIs Electron de impresion.
- No instalar SDKs/librerias de impresora.
- No implementar ESC/POS.
- No implementar impresion silenciosa obligatoria.
- No abrir gaveta.
- No integrar impresora fiscal.
- No modificar POS, caja, pedidos ni facturacion.
- No modificar backend, SQL, permisos ni contratos API.
- No implementar offline ni sync.

## Decisions

### 1. Usar flujos web existentes como base

Decision: v0.0.1 debe apoyarse en los tickets PDF y `window.print` ya existentes.

Rationale: reduce cambios, evita duplicar plantillas y mantiene el backend/reporteria como origen de documentos imprimibles.

Alternativa considerada: crear helper Electron inmediato. Se descarta porque no hay necesidad funcional si los flujos web ya imprimen con Chromium.

### 2. No exponer preload API en esta fase

Decision: no agregar `window.manusElectron.printCurrentView()` ahora.

Rationale: cualquier API preload nueva debe tener contrato, validacion y QA. La impresion inicial puede vivir en web sin ampliar superficie nativa.

Alternativa considerada: exponer API experimental. Se descarta por alcance y porque no debe tocar POS/caja/facturacion.

### 3. `webContents.print` queda evolucion futura

Decision: documentar `webContents.print` como opcion futura controlada desde main process.

Rationale: podria permitir mejor control de impresora, copias y margenes en Electron, pero necesita configuracion por terminal y seguridad.

Alternativa considerada: impresion silenciosa inmediata. Se descarta porque requiere configuracion explicita y QA de impresora real.

### 4. No mezclar documentos

Decision: recibo operativo, ticket POS, factura, comprobante de caja y documento fiscal deben tratarse como conceptos separados.

Rationale: cada uno tiene reglas, autoridad y riesgos distintos. La impresion no debe crear ni alterar estados.

## Risks / Trade-offs

| Riesgo | Mitigacion |
| --- | --- |
| Dialogo de impresion puede variar por Windows/driver | QA manual por Windows e impresora instalada. |
| Popups bloqueados en web print | Mantener fallback "Ver ticket" y documentar. |
| PDF no ajusta a papel termico | Fase futura de plantilla/tamano de papel por terminal. |
| Impresion automatica confundida con fiscal | Documentar que no hay fiscal printer ni cumplimiento fiscal. |
| `webContents.print` futuro puede ampliar superficie nativa | Exigir preload estrecho y configuracion explicita. |

## Migration Plan

No hay migracion de datos ni despliegue funcional.

Pasos:

1. Crear OpenSpec change.
2. Documentar discovery de flujos web de impresion.
3. Documentar estrategia inicial y limites.
4. Enlazar desde documentos de perifericos/empaquetado si aplica.
5. Crear evidencia QA documental.
6. Ejecutar OpenSpec strict y `git diff --check`.

Rollback: revertir documentos y OpenSpec. No hay codigo ni dependencias que revertir.

## Open Questions

- Si se necesitara una plantilla de recibo termico separada de los PDFs actuales.
- Si `webContents.print` futuro imprimira la vista actual, un iframe PDF o una ventana dedicada.
- Como se registrara impresora default por terminal cuando exista configuracion persistente.
- Si la impresion silenciosa se permitira solo para terminales autorizadas.
