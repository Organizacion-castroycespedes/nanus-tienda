# Delta spec: electronic-invoicing-customers

## ADDED Requirements

### Requirement: Gestion fiscal de clientes/adquirientes

El sistema SHALL permitir gestionar datos fiscales de clientes/adquirientes para preparar facturacion electronica en Colombia sin romper el cliente operativo actual.

#### Scenario: Crear cliente fiscal manual

- GIVEN un usuario autenticado con permiso de escritura
- WHEN crea un cliente fiscal con nombre, tipo de documento y numero
- THEN el sistema SHALL crear un registro tenant-aware asociado a `customers`
- AND SHALL permitir `fiscalEmail` ausente en esta etapa
- AND SHALL devolver el `customerId` canonico usado por ventas y pedidos.

#### Scenario: Cliente operativo existente sigue compatible

- GIVEN un cliente existente creado por `/api/customers`
- WHEN se consulta desde ventas, pedidos o reporteria
- THEN el sistema SHALL conservar `id`, `name`, `documentNumber`, `email`, `isActive` y fechas actuales
- AND los nuevos campos fiscales SHALL ser opcionales o tener defaults seguros.

#### Scenario: Datos fiscales separados de datos operativos

- GIVEN un cliente con `email` operativo y `fiscalEmail`
- WHEN se prepare una factura electronica futura
- THEN el sistema SHALL usar `fiscalEmail` como correo de recepcion de factura electronica
- AND SHALL NOT asumir que `email` general siempre sirve para recepcion fiscal.

### Requirement: Catalogo versionable de tipos de documento DIAN

El sistema SHALL exponer un catalogo backend versionable de tipos de documento DIAN para clientes/adquirientes.

#### Scenario: Consultar catalogo activo

- GIVEN un usuario autenticado
- WHEN consulta `GET /api/electronic-invoicing/document-types`
- THEN el sistema SHALL devolver tipos activos con `code`, `name`, `shortName` y `requiresVerificationDigit`.

#### Scenario: Validar tipo de documento

- GIVEN un usuario crea o actualiza cliente fiscal
- WHEN envia un `documentTypeCode`
- THEN el sistema SHALL validar que el tipo exista y este activo.

#### Scenario: Catalogo versionable inicial

- GIVEN existe una fuente DIAN o de proveedor vigente confirmada
- WHEN se cargue el catalogo en una fase futura
- THEN el sistema SHALL sembrar datos desde esa fuente confirmada
- AND SHALL conservar metadatos de fuente y version.

#### Scenario: No hardcodear tipos DIAN

- GIVEN el backend valida tipos de documento
- WHEN ejecuta validaciones fiscales
- THEN el sistema SHALL consultar `dian_document_types`
- AND SHALL NOT depender de listas hardcodeadas en codigo funcional.

### Requirement: Unicidad fiscal por tenant

El sistema SHALL evitar duplicados fiscales por tenant, tipo de documento y numero normalizado.

#### Scenario: Duplicado en mismo tenant

- GIVEN existe un cliente activo con `documentTypeCode = "31"` y `documentNumber = "900123456"` en un tenant
- WHEN se intenta crear otro cliente con el mismo tipo y numero en el mismo tenant
- THEN el sistema SHALL rechazar la operacion con error de duplicado.

#### Scenario: Mismo documento en otro tenant

- GIVEN existe un cliente con documento fiscal en un tenant
- WHEN otro tenant crea un cliente con el mismo tipo y numero
- THEN el sistema MAY permitirlo porque la unicidad es por tenant.

#### Scenario: Normalizacion de documento

- GIVEN un documento ingresado con espacios, puntos, guiones o formato humano
- WHEN el sistema valida duplicados
- THEN SHALL comparar usando `documentNumberNormalized`.

### Requirement: NIT con digito de verificacion

El sistema SHALL soportar NIT con digito de verificacion.

#### Scenario: Crear NIT con DV

- GIVEN un usuario crea cliente con `documentTypeCode = "31"`
- WHEN envia `documentNumber` y `verificationDigit`
- THEN el sistema SHALL guardar el numero normalizado y el DV por separado.

#### Scenario: DV invalido

- GIVEN un usuario crea o actualiza cliente NIT
- WHEN el DV no cumple la regla aprobada
- THEN el sistema SHALL rechazar la operacion.

#### Scenario: Documento no NIT con DV

- GIVEN un tipo de documento diferente de NIT
- WHEN el usuario envia `verificationDigit`
- THEN el sistema SHALL rechazarlo o ignorarlo segun decision aprobada antes de implementar.

PREGUNTA ABIERTA: Confirmar si para tipos no NIT el backend debe rechazar DV o limpiarlo silenciosamente.

### Requirement: Email de recepcion de factura electronica

El sistema SHALL validar el email de recepcion de factura electronica.

#### Scenario: Email fiscal valido

- GIVEN un cliente fiscal no consumidor final
- WHEN se registra `fiscalEmail`
- THEN el sistema SHALL validar formato de email
- AND SHALL guardar el valor normalizado en minusculas.

#### Scenario: Email fiscal invalido

- GIVEN un usuario envia `fiscalEmail = "abc"`
- WHEN crea o actualiza cliente fiscal
- THEN el sistema SHALL rechazar la operacion.

#### Scenario: Registro manual sin email fiscal

- GIVEN DIAN no responde o el cliente aun no requiere emision electronica
- WHEN se registra manualmente
- THEN el sistema SHALL permitir `fiscalEmail` ausente
- AND SHALL impedir emision electronica futura hasta completar el email requerido.

#### Scenario: Emision electronica nominada requiere email fiscal

- GIVEN un cliente fiscal no consumidor final no tiene `fiscalEmail`
- WHEN una fase futura intente emitir factura electronica nominada y ese flujo requiera email
- THEN el sistema SHALL bloquear la emision hasta completar `fiscalEmail`.

### Requirement: Consumidor final protegido

El sistema SHALL garantizar un consumidor final por tenant y protegerlo contra eliminacion.

#### Scenario: Consumidor final existente

- GIVEN un tenant con `customers.is_default = true`
- WHEN se consulta consumidor final
- THEN el sistema SHALL devolver ese cliente como consumidor final.

#### Scenario: Asegurar consumidor final

- GIVEN un tenant sin consumidor final
- WHEN un usuario autorizado ejecuta `POST /api/electronic-invoicing/customers/default/ensure`
- THEN el sistema SHALL crear un consumidor final activo para ese tenant.

#### Scenario: No eliminar consumidor final

- GIVEN un cliente consumidor final
- WHEN un usuario intenta eliminarlo o inactivarlo
- THEN el sistema SHALL rechazar la operacion.

#### Scenario: Unicidad de consumidor final

- GIVEN ya existe consumidor final en un tenant
- WHEN se intenta marcar otro cliente como consumidor final
- THEN el sistema SHALL rechazar la operacion o mover la marca solo mediante flujo explicito aprobado.

#### Scenario: Consumidor final no se duplica por sucursal

- GIVEN un tenant tiene varias sucursales
- WHEN ventas POS de distintas sucursales usan consumidor final
- THEN el sistema SHALL reutilizar el consumidor final del tenant
- AND SHALL tomar la sucursal desde el contexto de venta, pedido o POS.

#### Scenario: POS vende con consumidor final sin email

- GIVEN POS no identifica cliente nominal
- WHEN crea una venta con consumidor final
- THEN el sistema SHALL permitir la venta sin `fiscalEmail`.

### Requirement: Backend especializado electronic-invoicing/customers

El sistema SHALL exponer endpoints especializados para clientes fiscales bajo `electronic-invoicing/customers`.

#### Scenario: Listar clientes fiscales

- GIVEN un usuario autenticado
- WHEN consulta `GET /api/electronic-invoicing/customers`
- THEN el sistema SHALL listar solo clientes del tenant efectivo
- AND SHALL soportar filtros por busqueda, tipo de documento, estado y estado DIAN.

#### Scenario: Obtener cliente fiscal

- GIVEN un usuario autenticado
- WHEN consulta un cliente por id
- THEN el sistema SHALL validar que el cliente pertenece al tenant efectivo.

#### Scenario: Crear cliente fiscal

- GIVEN un usuario con permiso de escritura
- WHEN crea cliente fiscal
- THEN el sistema SHALL validar unicidad, documento, email fiscal si viene informado y consumidor final
- AND SHALL registrar auditoria.

#### Scenario: Actualizar cliente fiscal

- GIVEN un usuario con permiso de escritura
- WHEN actualiza datos fiscales
- THEN el sistema SHALL validar reglas fiscales
- AND SHALL registrar before/after en auditoria.

### Requirement: Backend especializado electronic-invoicing/dian-acquirer

El sistema SHALL exponer endpoints desacoplados para consulta de adquiriente mediante adaptador provider-agnostic sin generar facturas.

#### Scenario: Adapter provider-agnostic

- GIVEN una fase futura implementa consulta de adquiriente
- WHEN configura la integracion
- THEN el sistema SHALL usar una abstraccion `ElectronicInvoicingProviderAdapter`
- AND SHALL permitir implementaciones `MOCK_LOCAL`, `DIAN_DIRECT` o `PROVIDER`.

#### Scenario: Preview MOCK_LOCAL

- GIVEN el modo configurado es `MOCK_LOCAL`
- WHEN el usuario ejecuta lookup preview
- THEN el sistema SHALL devolver una respuesta controlada de preview
- AND SHALL NOT llamar DIAN ni proveedor externo.

#### Scenario: Preview DIAN sin persistir

- GIVEN un usuario autenticado envia tipo y numero de documento
- WHEN ejecuta lookup preview
- THEN el sistema SHALL consultar el adapter configurado
- AND SHALL devolver datos normalizados y diferencias
- AND SHALL NOT modificar el cliente automaticamente.

#### Scenario: DIAN apagado

- GIVEN la integracion externa esta apagada
- WHEN se solicita consulta de adquiriente
- THEN el sistema SHALL devolver estado `DISABLED`
- AND SHALL permitir registro manual.

#### Scenario: DIAN no responde

- GIVEN el gateway DIAN responde timeout o error temporal
- WHEN el usuario intenta consultar
- THEN el sistema SHALL registrar resultado `ERROR`
- AND SHALL permitir registro manual.

#### Scenario: DIAN sin datos

- GIVEN DIAN responde que no encuentra adquiriente
- WHEN el usuario consulta
- THEN el sistema SHALL registrar resultado `NOT_FOUND`
- AND SHALL permitir registro manual.

### Requirement: No sobrescritura automatica con DIAN

El sistema SHALL impedir que la respuesta DIAN sobrescriba datos existentes sin confirmacion explicita.

#### Scenario: DIAN devuelve dato diferente

- GIVEN un cliente tiene `legalName = "ACME"`
- AND DIAN devuelve `legalName = "ACME SAS"`
- WHEN se muestra preview
- THEN el sistema SHALL devolver diff entre valor actual y valor DIAN
- AND SHALL mantener el valor actual hasta que el usuario confirme.

#### Scenario: Aplicar campos seleccionados

- GIVEN un preview DIAN exitoso
- WHEN el usuario aplica con `overwriteConfirmed = true` y estrategia por campo
- THEN el sistema SHALL actualizar solo los campos seleccionados
- AND SHALL conservar los campos marcados como manuales.

#### Scenario: Conservar campos manuales

- GIVEN un campo esta marcado como manual
- WHEN se aplica respuesta DIAN
- THEN el sistema SHALL conservar ese campo salvo confirmacion explicita para reemplazarlo.

### Requirement: Fecha y resultado de ultima consulta DIAN

El sistema SHALL registrar la fecha y el resultado de la ultima consulta DIAN/proveedor/mock por cliente.

#### Scenario: Consulta exitosa

- GIVEN una consulta DIAN/proveedor/mock exitosa para cliente existente
- WHEN termina la consulta
- THEN el sistema SHALL actualizar `dianLastLookupAt`
- AND SHALL actualizar `dianLastLookupStatus = "SUCCESS"`.

#### Scenario: Consulta fallida

- GIVEN una consulta DIAN falla
- WHEN termina con error controlado
- THEN el sistema SHALL actualizar `dianLastLookupAt`
- AND SHALL actualizar `dianLastLookupStatus = "ERROR"`.

#### Scenario: Consulta desactivada

- GIVEN la integracion externa esta apagada
- WHEN el usuario intenta consultar
- THEN el sistema SHALL registrar o devolver `DISABLED`
- AND SHALL NOT bloquear registro manual.

### Requirement: Privacidad de respuestas DIAN/proveedor

El sistema SHALL guardar solo resumen operativo de consultas externas en la primera version.

#### Scenario: Registrar resumen operativo

- GIVEN una consulta de adquiriente termina con cualquier resultado
- WHEN se registra trazabilidad
- THEN el sistema SHALL guardar `status`, `statusCode`, `message`, `provider`, `lookupAt`, `requestHash` y `responseSummary`
- AND SHALL NOT guardar raw response completo.

#### Scenario: Raw response futuro

- GIVEN una fase futura requiere conservar raw response
- WHEN se disene ese almacenamiento
- THEN el sistema SHALL exigir cifrado o almacenamiento seguro
- AND SHALL documentar retencion y acceso antes de implementarlo.

### Requirement: Auditoria de cambios fiscales

El sistema SHALL auditar cambios fiscales sensibles.

#### Scenario: Crear cliente fiscal

- GIVEN un usuario crea cliente fiscal
- WHEN la operacion termina
- THEN el sistema SHALL registrar evento `EI_CUSTOMER_CREATED`.

#### Scenario: Actualizar cliente fiscal

- GIVEN un usuario actualiza documento, DV, email fiscal, razon social o datos DIAN
- WHEN la operacion termina
- THEN el sistema SHALL registrar `EI_CUSTOMER_UPDATED`
- AND SHALL incluir before/after de campos relevantes.

#### Scenario: Aplicar datos DIAN

- GIVEN un usuario aplica resultado DIAN
- WHEN la operacion termina
- THEN el sistema SHALL registrar `DIAN_ACQUIRER_APPLIED`
- AND SHALL vincular el `lookupId`.

### Requirement: Seguridad tenant-aware

El sistema SHALL proteger endpoints fiscales con JWT y tenant scope.

#### Scenario: Usuario sin token

- GIVEN un request sin Bearer token
- WHEN llama endpoint fiscal
- THEN el sistema SHALL rechazar con `Unauthorized`.

#### Scenario: Usuario de otro tenant

- GIVEN un usuario autenticado de tenant A
- WHEN intenta consultar cliente de tenant B
- THEN el sistema SHALL rechazar o responder not found sin filtrar datos.

#### Scenario: Usuario sin permiso

- GIVEN un usuario autenticado sin permiso de lectura o escritura
- WHEN llama endpoint protegido
- THEN el sistema SHALL rechazar con `Forbidden`
- AND SHALL usar la menu key principal `ELECTRONIC_INVOICING_CUSTOMERS`.

#### Scenario: Menu keys futuras reservadas

- GIVEN se disenen fases futuras de documentos, configuracion o reportes
- WHEN se creen permisos de menu
- THEN el sistema SHALL reservar `ELECTRONIC_INVOICING_DOCUMENTS`, `ELECTRONIC_INVOICING_SETTINGS` y `ELECTRONIC_INVOICING_REPORTS`.

#### Scenario: SUPER_ADMIN con tenant explicito

- GIVEN un `SUPER_ADMIN`
- WHEN consulta por tenant explicito
- THEN el sistema MAY permitirlo solo si el endpoint define esa regla de forma explicita.

### Requirement: Variables de entorno DIAN

El sistema SHALL preparar configuracion por variables de entorno para consulta DIAN.

#### Scenario: Integracion apagada por defecto

- GIVEN no existe configuracion DIAN
- WHEN el servicio inicia
- THEN `DIAN_ACQUIRER_ENABLED` SHALL comportarse como `false`.

#### Scenario: Timeout configurado

- GIVEN `DIAN_ACQUIRER_TIMEOUT_MS` definido
- WHEN se consulta DIAN
- THEN el gateway SHALL respetar ese timeout.

#### Scenario: No exponer secretos

- GIVEN hay certificado o password DIAN
- WHEN ocurre error
- THEN el sistema SHALL NOT registrar secretos en logs ni auditoria.

### Requirement: Registro manual siempre disponible

El sistema SHALL permitir registro manual de adquirientes aunque DIAN/proveedor no este disponible.

#### Scenario: DIAN desactivado

- GIVEN la integracion externa esta desactivada
- WHEN un usuario crea cliente fiscal manual
- THEN el sistema SHALL permitirlo si pasa validaciones locales.

#### Scenario: DIAN con error

- GIVEN DIAN/proveedor retorna error temporal
- WHEN el usuario decide guardar manual
- THEN el sistema SHALL permitir guardar manual
- AND SHALL conservar el ultimo resultado DIAN como `ERROR`.

### Requirement: Compatibilidad con clientes, ventas, pedidos y POS actuales

El sistema SHALL preservar contratos operativos actuales mientras agrega datos fiscales.

#### Scenario: `/api/customers` no rompe compatibilidad

- GIVEN un cliente operativo actual
- WHEN se usa por `/api/customers`, ventas, pedidos, POS o reportes
- THEN el sistema SHALL conservar `customers.id`, `name`, `document_number` e `is_active`
- AND los campos fiscales nuevos SHALL ser opcionales inicialmente.

#### Scenario: Fallback consumidor final

- GIVEN una venta no tiene cliente identificado
- WHEN el flujo necesita un `customerId`
- THEN el sistema SHALL usar consumidor final como fallback tenant-aware.

### Requirement: Preparacion para facturacion electronica sin UBL

El sistema SHALL preparar datos de adquiriente sin generar documentos electronicos.

#### Scenario: No generar factura

- GIVEN un usuario crea o actualiza cliente fiscal
- WHEN la operacion termina
- THEN el sistema SHALL NOT generar factura electronica
- AND SHALL NOT generar XML UBL
- AND SHALL NOT firmar documentos.

#### Scenario: Datos listos para fase futura

- GIVEN un cliente fiscal completo
- WHEN una fase futura implemente emision electronica
- THEN podra usar `customerId`, tipo de documento, numero, DV, razon social, email fiscal y ubicacion fiscal.

## Riesgos

RIESGO: El catalogo minimo de tipos de documento debe confirmarse contra fuente DIAN vigente antes de implementar migraciones.

RIESGO: El consumidor final puede requerir reglas especificas de proveedor tecnologico.

RIESGO: El endpoint actual `/api/customers` no tiene permisos granulares; endurecerlo sin plan puede romper frontend actual.

RIESGO: La consulta DIAN puede devolver datos incompletos o inconsistentes con datos manuales.

RIESGO: Almacenar raw responses DIAN puede aumentar riesgo de privacidad.

## Preguntas abiertas

PREGUNTA ABIERTA: Que valores fiscales exactos debe tener consumidor final?

PREGUNTA ABIERTA: Se agregara validation pipe global en NestJS antes de estos DTOs?

PREGUNTA ABIERTA: Que fuente oficial y version exacta se usara para sembrar `dian_document_types`?

PREGUNTA ABIERTA: Cual sera la politica de retencion para `dian_acquirer_lookup_logs`?

PREGUNTA ABIERTA: Como se hara backfill de clientes existentes con `document_number` sin `documentTypeCode`?

PREGUNTA ABIERTA: Que criterio habilita pasar de `MOCK_LOCAL` a DIAN directo o proveedor tecnologico?

PREGUNTA ABIERTA: Para tipos no NIT, el backend debe rechazar `verificationDigit` o limpiarlo silenciosamente?
