## Context

La fase 3 dejó el calendario de alertas, la bitácora `control_center.billing_alerts` con restricción de canal `DASHBOARD`/`EMAIL` y un `EmailSender` inyectable. Desde la fase 1, la cuenta comercial guarda `contact_phone_e164`, `whatsapp_opt_in` y `whatsapp_opt_in_at`, y la base de datos exige teléfono para que haya consentimiento. Reportería ya usa `pdfmake` 0.2.x para sus PDF. El propietario todavía no tiene cuenta de WhatsApp Business Platform.

## Goals / Non-Goals

**Goals:**

- Enviar recordatorios por WhatsApp solo a cuentas con consentimiento, con plantillas aprobadas, sin duplicar y con trazabilidad.
- Poder dejar todo instalado y apagado hasta que Meta apruebe la cuenta y las plantillas.
- Generar en el servidor un PDF del contrato, reproducible para cualquier versión, listo para firmar.

**Non-Goals:**

- Webhooks de estado de entrega o lectura de WhatsApp, y mensajes entrantes (conversaciones).
- Firma electrónica o almacenamiento del PDF firmado.
- Editar las cláusulas desde la interfaz: se cambian con un archivo de texto.
- Facturación electrónica de MANUS.

## Decisions

### D1. Canal WhatsApp en el calendario existente

- Se agrega `WHATSAPP` a la restricción `chk_cc_ba_channel` (V115). El índice único `(cargo, etapa, canal)` para el worker ya cubre el nuevo canal.
- Para cada cargo y etapa vigente, `processWhatsapp` sigue la misma regla que el correo:
  - si hay registro previo, solo reintenta los `FAILED` con menos de 3 intentos;
  - si el canal está apagado, la configuración está incompleta o la cuenta no tiene `whatsapp_opt_in` con teléfono, registra `SKIPPED` con el motivo;
  - en otro caso, reserva el registro como `FAILED` con 0 intentos, envía fuera de transacción y marca el resultado.
- Las etapas son las mismas del correo, por decisión del propietario.

### D2. Envío por WhatsApp Cloud API

- **Llamada:**
  - `POST https://graph.facebook.com/{CONTROL_CENTER_WHATSAPP_API_VERSION}/{CONTROL_CENTER_WHATSAPP_PHONE_NUMBER_ID}/messages`;
  - encabezado `Authorization: Bearer {CONTROL_CENTER_WHATSAPP_ACCESS_TOKEN}`, tiempo máximo de 15 s;
  - se usa el `fetch` nativo de Node 24.
- **Cuerpo del mensaje:** `type: template`, con `name` según la etapa y `language.code` igual a `CONTROL_CENTER_WHATSAPP_TEMPLATE_LANG` (por defecto `es`).
  - Plantillas: `CONTROL_CENTER_WHATSAPP_TEMPLATE_UPCOMING`, `..._DUE` y `..._OVERDUE`.
  - Parámetros posicionales del cuerpo: `{{1}}` cliente, `{{2}}` cargo, `{{3}}` saldo en pesos, `{{4}}` fecha de vencimiento y, solo en mora, `{{5}}` días de mora.
- **Destinatario:** el teléfono E.164 sin el signo `+`.
- **Errores:** se guarda el código y el mensaje del error de Meta, sin el token. Por defecto, la versión de la API es `v23.0`, configurable.
- **Plantillas sugeridas:** quedan en el runbook para enviarlas a aprobación en WhatsApp Manager, en la categoría *Utility*.
- **Mensaje de prueba:** `POST alerts/test-whatsapp` (`{ to }` en E.164) envía la plantilla de muestra `hello_world` (`en_US`) que Meta crea en toda cuenta nueva. Queda auditado.
- **Recordatorio manual:** `POST charges/:id/remind` acepta `{ channel: "EMAIL" | "WHATSAPP" }`; por defecto usa `EMAIL`.

**Alternativa descartada:** usar un intermediario (Twilio u otro). Agrega un recargo por mensaje y otra cuenta que administrar; la Cloud API directa es suficiente.

### D3. Estado del canal

`GET alerts/status` suma `whatsappEnabled`, `whatsappReady` y `whatsappMissing`, sin exponer el token. El panel de alertas de Cartera muestra el estado y el botón "WhatsApp de prueba".

### D4. PDF del contrato

- **Endpoint:** `GET contracts/:id/pdf?versionId=` devuelve `application/pdf` con `Content-Disposition: attachment; filename="<número>-v<versión>.pdf"`.
  - Sin `versionId`, usa la versión vigente, o la última si el contrato ya no está activo.
  - Se audita `CONTRACT_PDF_DOWNLOADED`.
- **Motor:** `pdfmake` 0.2.x con las fuentes estándar Helvetica, sin archivos de fuentes. Así el resultado es el mismo en Windows y Linux. La definición del documento sale de una función pura que se puede probar.
- **Contenido del documento:**
  1. Encabezado con los datos del emisor. El emisor es la empresa del tenant plataforma y se edita en MANUS (Configuración de la empresa y marca) sin variables nuevas:
     - razón social, NIT y DV, dirección, ciudad, teléfono, correo y sitio web salen de `public.tenants_detalles`;
     - el logo sale de `public.tenants.config->logo`, solo si es una imagen PNG o JPEG embebida (`data:`); no se descargan URL externas;
     - si faltan datos, el encabezado muestra lo disponible y el nombre del tenant.
  2. Título "Contrato de licencia de uso de MANUS POS", número, versión, estado y fecha de emisión.
  3. Datos del cliente (razón social, identificación, correo, contacto) y del tenant.
  4. Condiciones:
     - plan y fase (término inicial o renovación) y frecuencia;
     - vigencia, fin de la prueba, inicio de facturación y día de corte;
     - política de prorrateo, terminales incluidas y contratadas, e impuesto.
  5. Tabla de ítems (concepto, frecuencia, cantidad, valor unitario, descuento y total) y totales por frecuencia con base, IVA y total.
  6. Cláusulas: las del archivo `CONTROL_CENTER_CONTRACT_TERMS_FILE` (líneas `## Título` y párrafos) o, si no existe, cláusulas base incluidas en el código. Estas cubren objeto, vigencia y prueba, precio y pago, cambios y prorrateo, mora y recordatorios, certificado DIAN, soporte, terminación y tratamiento de datos personales.
  7. Firmas del emisor y del cliente.
  8. Pie con número de contrato y página.
- **Instrucciones de pago:** se incluyen las de `CONTROL_CENTER_PAYMENT_INSTRUCTIONS` en la cláusula de pago.
- **Marca de borrador:** los contratos en borrador llevan una marca de agua "BORRADOR".

Las cláusulas base son una plantilla para revisar con asesoría legal antes de usarlas con clientes.

### D4b. Por qué no se guarda aparte ni se genera en reportería

- **Sin tabla nueva:** MANUS ya guarda los datos de empresa de cada tenant (`tenants_detalles`) y su logo (`tenants.config`). El emisor del contrato es el tenant plataforma, así que se reutilizan esos datos con lectura por columnas. Una tabla o variables propias duplicarían la información.
- **Sin pasar por reportería:** `backend-reporteria` genera los reportes operativos con su propio acceso a datos y no tiene, ni debe tener, acceso al esquema `control_center`. El PDF se genera en el módulo del Control Center con la misma librería (`pdfmake` 0.2.x), sin llamadas entre servicios ni datos de contratos fuera del módulo.

### D5. Web

- **Ficha del contrato:** botón "Descargar PDF" para la versión vigente y un enlace por versión, con descarga como blob autenticado.
- **Detalle del cargo:** selector de canal en "Enviar recordatorio".
- **Panel de alertas:** estado de WhatsApp y prueba.

## Risks / Trade-offs

- **Aprobación de Meta y costo por mensaje.** El canal queda apagado por defecto. Solo se envía con consentimiento y con plantillas *Utility*. El propietario eligió los mismos seis momentos del correo, así que puede haber hasta 6 mensajes por cargo.
- **Token de larga duración.** Se recomienda un token de usuario del sistema de Meta Business guardado como secreto. Si se revoca, las alertas quedan `FAILED` con el error y el correo sigue funcionando.
- **Cláusulas legales.** Las cláusulas base son genéricas. El archivo de cláusulas permite reemplazarlas sin desplegar código.
- **Datos de empresa incompletos en el tenant plataforma.** El PDF se genera igual con lo disponible; el runbook indica dónde completarlos.
- **Dependencia `pdfmake` en la API.** Es la misma versión que ya usa reportería y no pesa en el arranque.

## Migration Plan

- V115 es aditiva: reemplaza la restricción de canal y agrega permisos de lectura por columnas.
- WhatsApp se despliega apagado. Se activa después de aprobar las plantillas y enviar el mensaje de prueba.
- El PDF funciona apenas se despliega.

**Rollback:** apagar WhatsApp y aplicar el rollback, que falla si ya hay alertas `WHATSAPP`.

## Open Questions

Ninguna bloqueante. Los datos reales del emisor se registran en la empresa y la marca del tenant plataforma de cada ambiente.
