## 1. Prerrequisitos

- [x] 1.1 Confirmar con el propietario el proveedor de WhatsApp, los momentos de envío, el contenido del PDF y su generación.
- [ ] 1.2 Crear la rama desde `develop` actualizado y registrar el ownership en `openspec-scope.json`.

## 2. Base de datos

- [ ] 2.1 `V115__control_center_whatsapp_channel.sql`: agregar `WHATSAPP` a `chk_cc_ba_channel` y lectura por columnas de `tenants_detalles` (dirección, sitio web), `municipios` y `tenants.config` para el emisor, con rollback protegido y prueba de contrato.

## 3. WhatsApp

- [ ] 3.1 Configuración `CONTROL_CENTER_WHATSAPP_*`, cliente de la Cloud API con `fetch` y tiempo máximo, y construcción del mensaje de plantilla con pruebas.
- [ ] 3.2 Canal en `ControlCenterAlertsService` (consentimiento, `SKIPPED`, reserva, reintentos), recordatorio manual con canal, prueba `alerts/test-whatsapp` y estado.
- [ ] 3.3 Plantillas sugeridas y guía de configuración en el runbook.

## 4. PDF del contrato

- [ ] 4.1 Definición pura del documento (emisor desde el tenant plataforma, cliente, condiciones, ítems, totales, cláusulas, firmas, marca de borrador) con pruebas.
- [ ] 4.2 Cláusulas base y lectura del archivo `CONTROL_CENTER_CONTRACT_TERMS_FILE`.
- [ ] 4.3 Endpoint `GET contracts/:id/pdf?versionId=` con `pdfmake`, auditoría y dependencia en `api/package.json`.

## 5. Web

- [ ] 5.1 "Descargar PDF" en la ficha y por versión; selector de canal en el recordatorio; estado y prueba de WhatsApp en Cartera.

## 6. Verificación

- [ ] 6.1 `openspec validate control-center-whatsapp-contrato-pdf --strict` y gobernanza STRICT.
- [ ] 6.2 QA local: PDF de la versión vigente y de una anterior, alerta de WhatsApp `SKIPPED` sin consentimiento o con canal apagado, recordatorio manual por correo.
- [ ] 6.3 Evidencia en `docs/evidencia-control-center-whatsapp-contrato-pdf.md`.
