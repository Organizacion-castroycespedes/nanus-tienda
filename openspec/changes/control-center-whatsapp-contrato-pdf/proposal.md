## Why

Con las fases 1 a 3 en `develop`, faltan dos cosas para cerrar el Control Center. Primero, avisar por WhatsApp, el canal que más leen los clientes. Segundo, entregar al cliente su contrato en un documento formal; hoy solo existe en pantalla.

Decisiones del propietario (2026-11-10):

- WhatsApp por la Cloud API de Meta, construido apagado hasta tener la cuenta verificada y las plantillas aprobadas;
- WhatsApp en los mismos momentos del correo: 5 días antes, vencimiento y 1, 7, 15 y 30 días de mora;
- PDF del contrato con resumen comercial, cláusulas base editables y espacio de firmas;
- el PDF lo genera el servidor.

## What Changes

- **Canal `WHATSAPP` en las alertas de cobro.** Usa el teléfono E.164 de la cuenta comercial y solo se envía si la cuenta tiene consentimiento (`whatsapp_opt_in`); si no, la alerta queda `SKIPPED` con el motivo. Se envía con plantillas aprobadas por Meta (aviso previo, vencimiento y mora), con la misma idempotencia y los mismos reintentos del correo.
- **Configuración** `CONTROL_CENTER_WHATSAPP_*`: identificador del número, token, versión de la API, idioma y nombres de plantilla. Usa el `fetch` de Node, sin dependencias nuevas.
- **Control Center:** estado del canal, mensaje de prueba y recordatorio manual por WhatsApp desde el detalle del cargo.
- **PDF del contrato** (`GET contracts/:id/pdf?versionId=`), generado con `pdfmake` (la misma librería de reportería):
  - datos del emisor tomados de la empresa del tenant plataforma en MANUS (`tenants_detalles` y logo de `tenants.config`), cliente y tenant, plan, ítems y precios con IVA, totales por frecuencia, vigencia, prueba, día de corte, terminales contratadas;
  - cláusulas base, reemplazables con un archivo de texto, y bloque de firmas;
  - la descarga queda auditada.
- **Web:** botón "Descargar PDF" en la ficha del contrato y en cada versión.
- **Migración V115:** amplía la restricción de canal de `billing_alerts` a `WHATSAPP` y concede lectura por columnas de los datos de empresa del emisor (dirección, sitio web, municipio y logo).

## Capabilities

### New Capabilities

- `control-center-whatsapp-alerts`: recordatorios de cobro por WhatsApp Cloud API con consentimiento.
- `control-center-contract-pdf`: documento PDF del contrato para entregar al cliente.

### Modified Capabilities

- `control-center-alert-schedule`: las etapas aplican también al canal `WHATSAPP`.

## Impact

- **Base de datos:** migración `V115__control_center_whatsapp_channel.sql` y su rollback.
- **API:**
  - `api/src/modules/control-center/alerts/**` (canal WhatsApp) y `contracts/**` (PDF);
  - dependencia `pdfmake` en `api/package.json` y `api/package-lock.json`.
- **Web:** `web/domains/control-center/**`.
- **Variables nuevas:**
  - `CONTROL_CENTER_WHATSAPP_*`;
  - `CONTROL_CENTER_CONTRACT_TERMS_FILE` (cláusulas).
