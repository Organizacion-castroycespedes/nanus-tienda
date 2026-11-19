## ADDED Requirements

### Requirement: Alta atómica de empresa con configuración base
El sistema SHALL crear el tenant y aprovisionar su configuración base en una única transacción PostgreSQL, usando el mismo cliente para todas las sentencias, y SHALL NOT dejar el tenant ni filas parciales cuando cualquier paso falle.

#### Scenario: Creación exitosa
- **WHEN** el SUPER_ADMIN del tenant plataforma crea una empresa con nombre válido
- **THEN** la respuesta conserva `id`, `slug`, `nombre`, `activo` y `config`, e incluye `bootstrap.status = COMPLETED` con los conteos copiados

#### Scenario: Fallo intermedio
- **WHEN** una sentencia del aprovisionamiento falla después de insertar el tenant y algunos menús
- **THEN** el sistema revierte la transacción y no existe el tenant ni ninguna fila asociada

#### Scenario: Kill switch
- **WHEN** `TENANT_BOOTSTRAP_ENABLED=false`
- **THEN** el sistema crea solo el tenant, sin catálogos y sin campo `bootstrap`

### Requirement: Origen de la configuración
El sistema SHALL tomar la configuración del tenant `PLATFORM_TENANT_ID` (por defecto `00000000-0000-0000-0000-000000000001`) y SHALL abortar el alta si el origen no existe, está inactivo o no tiene menú copiable.

#### Scenario: Origen faltante
- **WHEN** `PLATFORM_TENANT_ID` apunta a un tenant inexistente
- **THEN** el sistema responde 503 con `TENANT_BOOTSTRAP_SOURCE_MISSING` y no crea el tenant

#### Scenario: Origen sin menú
- **WHEN** el tenant origen no tiene ítems de menú copiables
- **THEN** el sistema responde 503 con `TENANT_BOOTSTRAP_SOURCE_INCOMPLETE` y no crea el tenant

### Requirement: Menús y permisos
El sistema SHALL copiar los ítems de menú no eliminados del origen con UUID nuevos y la misma jerarquía por `key`, SHALL excluir los ítems con `metadata.scope = PLATFORM_ONLY` y todo su subárbol, y SHALL copiar los permisos de esos ítems conservando el `role_id` global, `access_level` y `actions`.

#### Scenario: Jerarquía remapeada
- **WHEN** se aprovisiona una empresa
- **THEN** cada ítem copiado tiene como padre el ítem del mismo tenant con la `key` del padre en el origen, y ningún padre ni permiso apunta a un menú de otro tenant

#### Scenario: Ítems exclusivos de la plataforma
- **WHEN** el origen tiene `CONTROL_CENTER` con `scope = PLATFORM_ONLY` y un hijo
- **THEN** ni el ítem, ni el hijo, ni sus permisos existen en la empresa nueva

#### Scenario: Ítem eliminado
- **WHEN** un ítem del origen tiene `deleted_at`
- **THEN** no se copia

### Requirement: Consumidor final
El sistema SHALL generar exactamente un cliente consumidor final activo y predeterminado, usando como plantilla la identidad del consumidor final del origen, y SHALL NOT copiar correo, teléfono, dirección, municipio, departamento, códigos de ubicación ni metadatos DIAN.

#### Scenario: Datos de contacto del origen
- **WHEN** el consumidor final del origen tiene correo, teléfono, dirección y municipio
- **THEN** el consumidor final de la empresa nueva los tiene nulos y conserva el tipo y número de identificación DIAN

#### Scenario: Otros clientes del origen
- **WHEN** el origen tiene clientes que no son consumidor final
- **THEN** ninguno se copia

### Requirement: Catálogos base
El sistema SHALL copiar unidades activas (una por abreviatura normalizada), métodos de pago activos y sus vínculos activos a entidades financieras globales activas, y SHALL referenciar sin copiar los catálogos globales.

#### Scenario: Entidad financiera propia del origen
- **WHEN** un método de pago del origen está vinculado a una entidad global y a una entidad con `tenant_id` del origen
- **THEN** la empresa nueva solo queda vinculada a la entidad global

#### Scenario: Registros inactivos
- **WHEN** el origen tiene unidades o métodos de pago inactivos
- **THEN** no se copian

### Requirement: Impuestos y tarifas
El sistema SHALL copiar los impuestos activos y clasificados del origen con UUID nuevos y sus tarifas activas no vencidas, SHALL excluir los grupos de impuestos activos con el mismo tipo y nombre normalizado y los impuestos sin clasificación fiscal, y SHALL reportarlos en `bootstrap.manual`.

#### Scenario: Tarifas vencidas y futuras
- **WHEN** un impuesto del origen tiene una tarifa vencida, una inactiva, una vigente y una futura
- **THEN** la empresa nueva recibe la vigente y la futura

#### Scenario: Impuesto ambiguo
- **WHEN** el origen tiene dos impuestos activos de tipo IVA llamados "IVA 19%" (incluido y no incluido)
- **THEN** ninguno se copia y ambos aparecen en `bootstrap.manual` para revisión

### Requirement: Exclusiones
El sistema SHALL NOT copiar usuarios, personas, roles de usuario, sesiones, credenciales, sucursales, terminales, cajas, productos, inventario, ventas, compras, pagos, domicilios, documentos y configuración de facturación electrónica, overrides de `tenant_settings`, detalles legales del tenant ni datos del Control Center.

#### Scenario: Tablas excluidas
- **WHEN** se aprovisiona una empresa
- **THEN** la empresa nueva no tiene filas en `tenant_settings`, `tenants_detalles`, `tenant_branches`, `users`, `user_roles`, `pos_terminals`, `products`, `tenant_electronic_billing_configs` ni `financial_institutions` propias

#### Scenario: El origen no cambia
- **WHEN** termina el aprovisionamiento
- **THEN** las filas del tenant plataforma y los catálogos globales son idénticos a los de antes

### Requirement: Autorización
El sistema SHALL permitir crear empresas solo al usuario con rol `SUPER_ADMIN` vigente en base de datos para el tenant plataforma.

#### Scenario: SUPER_ADMIN de otro tenant
- **WHEN** un usuario `SUPER_ADMIN` cuyo tenant no es el plataforma invoca `POST /api/tenants`
- **THEN** el sistema responde 403 y no crea nada

#### Scenario: Otros roles
- **WHEN** un usuario `ADMIN`, `SUPER_USER` o `USER` invoca `POST /api/tenants`
- **THEN** el sistema responde 403

### Requirement: Idempotencia, concurrencia y auditoría
El sistema SHALL serializar el aprovisionamiento por tenant destino, SHALL tratar como no-op un destino ya aprovisionado, SHALL rechazar un destino parcialmente inicializado y SHALL registrar `TENANT_BOOTSTRAP_COMPLETED` en `auditoria_eventos` dentro de la misma transacción.

#### Scenario: Reintento sobre destino aprovisionado
- **WHEN** se vuelve a ejecutar el aprovisionamiento sobre una empresa ya aprovisionada
- **THEN** devuelve `ALREADY_COMPLETED`, no escribe filas y no duplica el evento de auditoría

#### Scenario: Destino parcial
- **WHEN** el destino ya tiene filas en tablas gestionadas y no tiene evento de finalización
- **THEN** el sistema responde `TENANT_BOOTSTRAP_TARGET_NOT_EMPTY` (409) sin escribir

#### Scenario: Altas concurrentes
- **WHEN** se crean varias empresas en paralelo
- **THEN** cada una queda completa y aislada; si dos usan el mismo slug, una se crea y la otra recibe 409 sin residuos
