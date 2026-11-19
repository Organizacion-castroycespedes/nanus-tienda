# Evidencia: MANUS Control Center, cierre (WhatsApp y PDF del contrato)

OpenSpec: `control-center-whatsapp-contrato-pdf` · Rama: `feature/develop/control-center-whatsapp-contrato-pdf` · Fecha: 2026-11-10

## Alcance

- **Migración V115** (`V115__control_center_whatsapp_channel.sql`, SHA-256 `aa738ad1d5ab7ac0e7e0f25d8f64e78251735e744b32d4ae87dbb1488c8584ae`), con su rollback protegido y su prueba de contrato:
  - canal `WHATSAPP` en `control_center.billing_alerts`;
  - lectura por columnas de los datos del emisor: `tenants_detalles.direccion_principal`, `sitio_web`, `municipios` y `tenants.config`.
- **WhatsApp Cloud API (Meta):**
  - Se envía en las mismas etapas del correo, solo a cuentas con teléfono E.164 y consentimiento.
  - Usa tres plantillas *Utility* (aviso previo, vencimiento y mora).
  - Mismo esquema de idempotencia y reintentos que el correo, y los errores de Meta se guardan sin el token.
  - Usa el `fetch` nativo, sin dependencias nuevas.
  - Se despliega apagado (`CONTROL_CENTER_WHATSAPP_ENABLED=false`).
- **Endpoints:**
  - `POST alerts/test-whatsapp`, que envía la plantilla de muestra `hello_world`;
  - `POST charges/:id/remind` con `channel`;
  - el estado de WhatsApp en `GET alerts/status`.
- **PDF del contrato:** `GET contracts/:id/pdf?versionId=` con `pdfmake` 0.2.23 (la misma versión de reportería) y fuentes estándar Helvetica.
  - Incluye emisor (empresa del tenant plataforma), partes, condiciones, conceptos con IVA, totales por período, cláusulas base o del archivo `CONTROL_CENTER_CONTRACT_TERMS_FILE` y firmas.
  - Los borradores llevan la marca "BORRADOR". La descarga queda auditada (`CONTRACT_PDF_DOWNLOADED`).
- **Web:**
  - "Descargar PDF" en la ficha y "PDF" en cada versión;
  - "Recordar por correo" y "Recordar por WhatsApp" en el cargo;
  - estado y "WhatsApp de prueba" en Cartera.
- **Runbook:** guía de Meta (app, número, token de usuario del sistema y plantillas con su texto sugerido) y configuración del PDF.

## Validación automatizada (Windows, ejecutada por el agente local)

| Verificación | Resultado |
|---|---|
| `openspec validate control-center-whatsapp-contrato-pdf --strict` | Válido |
| Gobernanza STRICT con los archivos cambiados frente a `develop` | `REPOSITORY_GATE_STATUS=PASS`, `STRICT_PASS` |
| API: `tsc --noEmit` | OK |
| API: pruebas de `control-center`, `billing-notices` y guards | 167/167 |
| API: suite completa | 1090 pasan, 2 omitidas, 0 fallas |
| Web: pruebas | 14/14 |
| Web: lint | Sin advertencias ni errores |
| Web: `tsc --noEmit` | 26 errores preexistentes en `*.spec.ts` ajenos; 0 fuera de specs |
| Contrato SQL V111–V115 | 38 pruebas OK (5 omitidas sin bash en Windows; se ejecutan en CI) |

## Reglas verificadas en PostgreSQL 16 real

- **Precondición:** sin las columnas del emisor, V115 falla con `CONTROL_CENTER_ISSUER_COLUMNS_MISSING`.
- **Reaplicación:** V115 se aplica dos veces sin error.
- **Canal:** se acepta una alerta `WHATSAPP` y se rechaza un canal no permitido (`SMS`, por `chk_cc_ba_channel`).
- **Permisos del rol del Control Center:** lee los datos del emisor y no puede escribir en `public.tenants`.
- **Rollback:** se niega a deshacer si ya existen alertas `WHATSAPP`.

## Integración de servicios contra PostgreSQL real (Meta simulado)

- **Sin consentimiento:** la etapa queda `SKIPPED` ("La cuenta no autorizó mensajes por WhatsApp") y el recordatorio manual responde 422.
- **Error de Meta:** el `401` (código 190) se guarda como "Invalid OAuth=*** access token ***", sin el token.
- **Recordatorio manual:** usa `manus_cobro_vencido` hacia `+573022243805` con los parámetros cliente, cargo, saldo, vencimiento y días de mora.
- **Envío automático:** sale `manus_cobro_vence_hoy` para un prorrateo con vencimiento el mismo día. Una segunda ejecución no duplica el envío.
- **Prueba:** `hello_world` (`en_US`). Un número fuera de formato E.164 se rechaza con 400.

## PDF real (base local)

`tmp/MCC-2026-00003-v3.pdf` se generó con los servicios y la base local. Tiene 2 páginas tamaño carta y muestra:

- partes y condiciones: prueba hasta el 08/11/2026, día de corte 8, 3 terminales, IVA 19 % incluido;
- conceptos y totales: base $1.302.521 + IVA $247.479 = $1.550.000;
- las 9 cláusulas base con los medios de pago y el bloque de firmas.

Al momento del commit, el tenant plataforma local todavía tenía los datos de empresa anteriores y no tenía logo. El PDF toma los datos nuevos apenas se guardan en **Configuración → Empresa / Marca**, sin cambiar código ni `.env`.

## Pendiente

- **Meta:** crear la app y el número, generar el token permanente y aprobar las plantillas (ver runbook). Después, enviar el mensaje de prueba y activar `CONTROL_CENTER_WHATSAPP_ENABLED`.
- **Datos del emisor:** registrar los datos reales y el logo en el tenant plataforma de cada ambiente.
- **Revisión legal:** revisar las cláusulas base y, si aplica, definir `CONTROL_CENTER_CONTRACT_TERMS_FILE`.
- **QA:** aplicar V115 con el runner oficial en `manus_tienda_qa`.
