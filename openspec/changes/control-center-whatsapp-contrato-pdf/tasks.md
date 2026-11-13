## 1. Prerrequisitos

- [x] 1.1 Confirmar con el propietario el proveedor de WhatsApp, los momentos de envío, el contenido del PDF y su generación.
- [x] 1.2 Crear la rama desde `develop` actualizado y registrar el ownership en `openspec-scope.json`.

## 2. Base de datos

- [x] 2.1 `V115__control_center_whatsapp_channel.sql`: agregar `WHATSAPP` a `chk_cc_ba_channel` y lectura por columnas de `tenants_detalles` (dirección, sitio web), `municipios` y `tenants.config` para el emisor, con rollback protegido y prueba de contrato.

## 3. WhatsApp

- [x] 3.1 Configuración `CONTROL_CENTER_WHATSAPP_*`, cliente de la Cloud API con `fetch` y tiempo máximo, y construcción del mensaje de plantilla con pruebas.
- [x] 3.2 Canal en `ControlCenterAlertsService` (consentimiento, `SKIPPED`, reserva, reintentos), recordatorio manual con canal, prueba `alerts/test-whatsapp` y estado.
- [x] 3.3 Plantillas sugeridas y guía de configuración en el runbook.

## 4. PDF del contrato

- [x] 4.1 Definición pura del documento (emisor desde el tenant plataforma, cliente, condiciones, ítems, totales, cláusulas, firmas, marca de borrador) con pruebas.
- [x] 4.2 Cláusulas base y lectura del archivo `CONTROL_CENTER_CONTRACT_TERMS_FILE`.
- [x] 4.3 Endpoint `GET contracts/:id/pdf?versionId=` con `pdfmake`, auditoría y dependencia en `api/package.json`.

## 5. Web

- [x] 5.1 "Descargar PDF" en la ficha y por versión; selector de canal en el recordatorio; estado y prueba de WhatsApp en Cartera.

## 6. Verificación

- [x] 6.1 `openspec validate control-center-whatsapp-contrato-pdf --strict` y gobernanza STRICT.
- [x] 6.2 QA local: PDF de la versión vigente y de una anterior, alerta de WhatsApp `SKIPPED` sin consentimiento o con canal apagado, recordatorio manual por correo.
- [x] 6.3 Evidencia en `docs/evidencia-control-center-whatsapp-contrato-pdf.md`.
