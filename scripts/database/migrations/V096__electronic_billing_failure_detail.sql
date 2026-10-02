-- ================================
-- Fiscal failure resolutions catalog
-- ================================
CREATE TABLE IF NOT EXISTS fiscal_failure_resolutions (
  code TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  title TEXT NOT NULL,
  solution_text TEXT NOT NULL,
  retryable BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_fiscal_failure_resolutions_origin CHECK (origin IN ('FACTUCORE', 'DIAN', 'MANUS'))
);

-- ================================
-- Failure detail per electronic document attempt
-- ================================
CREATE TABLE IF NOT EXISTS electronic_document_failure_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  electronic_document_id UUID NOT NULL REFERENCES electronic_documents(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL DEFAULT 1,
  origin TEXT NOT NULL,
  code TEXT,
  message TEXT NOT NULL,
  path TEXT,
  severity TEXT,
  http_status INTEGER,
  failure_class TEXT NOT NULL,
  resolution_code TEXT REFERENCES fiscal_failure_resolutions(code) ON UPDATE CASCADE ON DELETE SET NULL,
  raw_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_electronic_document_failure_details_origin CHECK (origin IN ('FACTUCORE', 'DIAN', 'MANUS')),
  CONSTRAINT chk_electronic_document_failure_details_class CHECK (
    failure_class IN ('NETWORK_OR_TRANSIENT', 'DIAN_REJECTED', 'VALIDATION', 'CONFIGURATION', 'PENDING', 'UNKNOWN')
  ),
  CONSTRAINT chk_electronic_document_failure_details_attempt CHECK (attempt > 0)
);

CREATE INDEX IF NOT EXISTS idx_electronic_document_failure_details_document
  ON electronic_document_failure_details(electronic_document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_electronic_document_failure_details_tenant
  ON electronic_document_failure_details(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_electronic_document_failure_details_code
  ON electronic_document_failure_details(code);

-- ================================
-- Sale voids waiting for an accepted credit note
-- ================================
CREATE TABLE IF NOT EXISTS sale_void_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  sale_id UUID NOT NULL,
  invoice_electronic_document_id UUID REFERENCES electronic_documents(id) ON DELETE SET NULL,
  credit_note_electronic_document_id UUID REFERENCES electronic_documents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_CREDIT_NOTE',
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_until TIMESTAMPTZ,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_sale_void_requests_status CHECK (status IN ('PENDING_CREDIT_NOTE', 'COMPLETED', 'REJECTED', 'FAILED')),
  CONSTRAINT chk_sale_void_requests_attempts CHECK (attempt_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_void_requests_open
  ON sale_void_requests(tenant_id, sale_id)
  WHERE status = 'PENDING_CREDIT_NOTE';

CREATE INDEX IF NOT EXISTS idx_sale_void_requests_due
  ON sale_void_requests(status, next_attempt_at);

-- ================================
-- Seed: code -> solution
-- DIAN_PREFIX_* rows are the fallback when an exact DIAN rule is not cataloged.
-- ================================
INSERT INTO fiscal_failure_resolutions (code, origin, title, solution_text, retryable) VALUES
  ('FACTUCORE_NETWORK', 'FACTUCORE', 'Sin conexión con FactuCore', 'Falla de red entre Manus y FactuCore. El documento quedó en cola y se reintenta solo. Si persiste, verificar internet del servidor y que FactuCore esté en línea.', TRUE),
  ('FACTUCORE_TIMEOUT', 'FACTUCORE', 'FactuCore no respondió a tiempo', 'FactuCore o la DIAN tardaron más de lo permitido. El documento quedó en cola y se reintenta solo.', TRUE),
  ('FACTUCORE_UNAVAILABLE', 'FACTUCORE', 'FactuCore no disponible', 'FactuCore respondió con error 5xx. El documento quedó en cola y se reintenta solo. Si persiste, contactar soporte FactuCore.', TRUE),
  ('FACTUCORE_RATE_LIMIT', 'FACTUCORE', 'Límite de solicitudes FactuCore', 'Se superó el límite de solicitudes por minuto. El documento se reintenta automáticamente.', TRUE),
  ('FACTUCORE_AUTHENTICATION', 'FACTUCORE', 'Credenciales FactuCore inválidas', 'Revisar clientKey/clientSecret del API client en la configuración de facturación electrónica del tenant y sus permisos (create, generate_xml, sign, transmit).', FALSE),
  ('FACTUCORE_MISSING_CREDENTIALS', 'FACTUCORE', 'Faltan credenciales FactuCore', 'Configurar las credenciales del API client de FactuCore para el tenant.', FALSE),
  ('FACTUCORE_CONFIGURATION', 'FACTUCORE', 'Configuración FactuCore incompleta', 'Revisar baseUrl, factuCoreTenantId y credenciales en tenant_electronic_billing_configs.', FALSE),
  ('FACTUCORE_VALIDATION', 'FACTUCORE', 'FactuCore rechazó los datos', 'Corregir los campos indicados en el detalle (cliente, productos, impuestos o medios de pago) y reintentar.', FALSE),
  ('FACTUCORE_CONFLICT', 'FACTUCORE', 'Documento ya existe en FactuCore', 'La referencia externa ya fue usada con otros datos. Consultar el estado del documento antes de reintentar.', FALSE),
  ('FACTUCORE_TRANSMISSION_PREFLIGHT', 'FACTUCORE', 'Validación previa a DIAN falló', 'FactuCore bloqueó el envío por datos incompletos (resolución, certificado, cliente o impuestos). Corregir según el detalle y reintentar.', FALSE),
  ('FACTUCORE_TRANSMISSION_EXCEPTION', 'FACTUCORE', 'Error técnico transmitiendo a DIAN', 'Error técnico al transmitir. Se reintenta automáticamente; si persiste, revisar configuración DIAN del tenant en FactuCore.', TRUE),
  ('FACTUCORE_TRANSMISSION_IN_PROGRESS', 'FACTUCORE', 'Transmisión en curso', 'La transmisión ya estaba iniciada. Consultar estado en unos minutos.', TRUE),
  ('FACTUCORE_ATTACHMENT_NOT_FOUND', 'FACTUCORE', 'Archivo no disponible', 'El XML o PDF aún no está disponible. Consultar de nuevo más tarde.', TRUE),
  ('DIAN-SOAP-FAULT', 'DIAN', 'DIAN devolvió un error SOAP', 'Falla técnica del servicio DIAN. Se reintenta automáticamente.', TRUE),
  ('DIAN-EMPTY-RESPONSE', 'DIAN', 'DIAN respondió vacío', 'Falla técnica del servicio DIAN. Se reintenta automáticamente.', TRUE),
  ('DIAN-PARSE-ERROR', 'DIAN', 'Respuesta DIAN ilegible', 'La respuesta de la DIAN no se pudo interpretar. Se consulta el estado antes de reintentar.', TRUE),
  ('DIAN-DELIVERY-UNKNOWN', 'DIAN', 'Entrega a DIAN sin confirmar', 'Se perdió la conexión mientras se enviaba a la DIAN. Se consulta el estado del documento antes de reenviar para no duplicarlo.', TRUE),
  ('DIAN-UNEXPECTED', 'DIAN', 'Respuesta DIAN inesperada', 'Consultar el estado del documento. Si persiste, escalar a soporte FactuCore.', TRUE),
  ('DIAN-UNKNOWN', 'DIAN', 'Estado DIAN desconocido', 'Consultar el estado del documento en unos minutos.', TRUE),
  ('DIAN-TIMEOUT', 'DIAN', 'DIAN no respondió a tiempo', 'Servicio DIAN lento o caído. Se reintenta automáticamente.', TRUE),
  ('99', 'DIAN', 'Documento rechazado por la DIAN', 'La DIAN rechazó el documento. Revisar las reglas listadas en el detalle, corregir los datos y emitir de nuevo.', FALSE),
  ('90', 'DIAN', 'TrackId no encontrado en DIAN', 'La DIAN no encontró el envío. Consultar estado; si no aparece, reintentar la transmisión.', TRUE),
  ('66', 'DIAN', 'NSU no encontrado o pendiente', 'La DIAN aún no registra el documento. Consultar estado en unos minutos.', TRUE),
  ('FAT07', 'DIAN', 'Valor del tributo no coincide con la base', 'El impuesto de una línea no es base × tarifa. Revisar tarifa y base gravable del producto y el redondeo; corregir y reemitir.', FALSE),
  ('FAD03', 'DIAN', 'ProfileID inválido', 'Versión del documento UBL incorrecta. Es un problema del integrador: escalar a soporte FactuCore.', FALSE),
  ('FAB22b', 'DIAN', 'DV del NIT del proveedor tecnológico', 'El dígito de verificación del NIT del proveedor tecnológico está mal. Revisar la configuración del software DIAN en FactuCore.', FALSE),
  ('FAK61', 'DIAN', 'Datos del adquiriente incompletos', 'Falta información del cliente en la factura. Completar datos fiscales del cliente (identificación, dirección, municipio, correo) y reemitir.', FALSE),
  ('FAZ09', 'DIAN', 'Identificación del bien o servicio', 'Falta la identificación estándar del producto en la línea. Configurar el código estándar DIAN del producto.', FALSE),
  ('CAD02', 'DIAN', 'CustomizationID de nota crédito inválido', 'Tipo de operación de la nota crédito incorrecto. Escalar a soporte FactuCore.', FALSE),
  ('CAD03', 'DIAN', 'ProfileID de nota crédito', 'Versión del documento de nota crédito incorrecta. Escalar a soporte FactuCore.', FALSE),
  ('CAD06', 'DIAN', 'CUDE mal calculado', 'El CUDE de la nota crédito no coincide. Revisar clave técnica/software en FactuCore y reemitir.', FALSE),
  ('CBA06', 'DIAN', 'Referencia de nota crédito', 'Falta un dato obligatorio de la referencia a la factura origen. Verificar que la factura origen esté aceptada y reemitir.', FALSE),
  ('DAJ39', 'DIAN', 'TaxScheme del emisor (notificación)', 'Notificación DIAN: falta el grupo TaxScheme del emisor. No bloquea la aceptación; revisar la responsabilidad fiscal del emisor en FactuCore.', FALSE),
  ('DBF04', 'DIAN', 'Descripción fuera de lista (notificación)', 'Notificación DIAN: la descripción no está en la lista oficial. No bloquea la aceptación.', FALSE),
  ('DIAN_PREFIX_FAB', 'DIAN', 'Resolución o proveedor tecnológico', 'Regla sobre resolución de numeración o proveedor tecnológico. Revisar resolución DIAN vigente y software en FactuCore.', FALSE),
  ('DIAN_PREFIX_FAD', 'DIAN', 'Encabezado del documento', 'Regla sobre datos generales del documento (fechas, tipo, versión). Revisar con soporte FactuCore.', FALSE),
  ('DIAN_PREFIX_FAJ', 'DIAN', 'Datos del emisor', 'Regla sobre datos del emisor. Revisar NIT, dirección, municipio y responsabilidades fiscales del tenant en FactuCore.', FALSE),
  ('DIAN_PREFIX_FAK', 'DIAN', 'Datos del cliente', 'Regla sobre datos del cliente (adquiriente). Completar identificación, tipo de documento, dirección, municipio, correo y responsabilidades fiscales del cliente.', FALSE),
  ('DIAN_PREFIX_FAS', 'DIAN', 'Impuestos', 'Regla sobre impuestos del documento. Revisar tarifas e impuestos configurados en los productos.', FALSE),
  ('DIAN_PREFIX_FAT', 'DIAN', 'Totales de impuestos', 'Regla sobre totales de impuestos. Revisar base, tarifa y redondeos de impuestos de las líneas.', FALSE),
  ('DIAN_PREFIX_FAU', 'DIAN', 'Totales monetarios', 'Regla sobre totales (subtotal, descuentos, total a pagar). Revisar descuentos y redondeos de la venta.', FALSE),
  ('DIAN_PREFIX_FAZ', 'DIAN', 'Líneas del documento', 'Regla sobre las líneas (producto, cantidad, unidad, precio). Revisar datos del producto.', FALSE),
  ('DIAN_PREFIX_CAD', 'DIAN', 'Encabezado de nota crédito', 'Regla sobre datos generales de la nota crédito. Revisar con soporte FactuCore.', FALSE),
  ('DIAN_PREFIX_CBA', 'DIAN', 'Referencia de nota crédito', 'Regla sobre la referencia a la factura origen. Verificar la factura origen y el motivo de la nota.', FALSE)
ON CONFLICT (code) DO UPDATE
SET origin = EXCLUDED.origin,
    title = EXCLUDED.title,
    solution_text = EXCLUDED.solution_text,
    retryable = EXCLUDED.retryable,
    updated_at = NOW();
