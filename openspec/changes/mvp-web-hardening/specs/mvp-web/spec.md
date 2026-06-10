# Delta spec: mvp-web

## ADDED Requirements

### Requirement: MVP Web operational QA

El sistema SHALL contar con un checklist de QA operativo integral para validar los modulos core antes de salida MVP WEB.

#### Scenario: QA operativo con datos reales

- GIVEN un ambiente local o QA con datos reales o fixtures representativos
- WHEN se ejecuta la fase MVP-01
- THEN el equipo SHALL validar ventas, compras, pedidos, inventario, clientes, proveedores, caja y reportería
- AND SHALL documentar resultados, bugs y fixes en evidencia QA.

#### Scenario: Perifericos MOCK no se rompen

- GIVEN la iniciativa `add-pos-peripherals-platform` ya fue mergeada
- WHEN se ejecuta QA MVP WEB
- THEN el sistema SHALL mantener perifericos MOCK disponibles
- AND SHALL NOT requerir hardware fisico para completar el MVP WEB.

### Requirement: Electronic invoicing hardening

El sistema SHALL fortalecer los flujos de facturacion electronica requeridos para el MVP WEB.

#### Scenario: Cliente fiscal valido

- GIVEN un usuario autorizado registra o edita un cliente fiscal
- WHEN envia datos fiscales requeridos
- THEN el sistema SHALL validar datos obligatorios
- AND SHALL devolver errores claros sin stack traces.

#### Scenario: Proveedor fiscal valido

- GIVEN un usuario autorizado registra o edita un proveedor fiscal
- WHEN envia datos fiscales requeridos
- THEN el sistema SHALL validar datos obligatorios
- AND SHALL mantener identidad fiscal tenant-aware.

#### Scenario: GetAcquirer controlado

- GIVEN GetAcquirer esta configurado en modo permitido
- WHEN se solicita una consulta fiscal
- THEN el sistema SHALL usar la capa provider-agnostic aprobada
- AND SHALL registrar trazabilidad segura
- AND SHALL NOT exponer payloads sensibles en UI o logs.

### Requirement: Operational reporting

El sistema SHALL exponer reportería operativa suficiente para operar el MVP WEB.

#### Scenario: Reporteria de compras

- GIVEN un usuario autorizado consulta compras por rango de fechas
- WHEN existen compras registradas
- THEN el sistema SHALL mostrar totales, estados y filtros relevantes
- AND SHALL respetar tenant y sucursal.

#### Scenario: Reporteria de pedidos

- GIVEN un usuario autorizado consulta pedidos
- WHEN existen pedidos pendientes, parciales o completados
- THEN el sistema SHALL mostrar estado, total, saldo y filtros relevantes.

#### Scenario: Reporteria de inventario y productos

- GIVEN un usuario autorizado consulta inventario o productos
- WHEN existen productos con stock, lotes o movimientos
- THEN el sistema SHALL mostrar datos coherentes para operacion
- AND SHALL permitir detectar faltantes o inconsistencias MVP.

#### Scenario: Reporteria de caja y rentabilidad

- GIVEN un usuario autorizado consulta caja o rentabilidad
- WHEN existen ventas, pagos, compras o egresos
- THEN el sistema SHALL mostrar totales operativos coherentes
- AND SHALL documentar cualquier limitacion pendiente.

### Requirement: POS terminal operational hardening

El sistema SHALL operar con contexto claro de tenant, sucursal, terminal y caja activa.

#### Scenario: POS con contexto valido

- GIVEN un usuario abre el POS
- WHEN selecciona o resuelve sucursal, terminal y caja activa
- THEN el POS SHALL permitir operar ventas
- AND SHALL mostrar errores controlados si el contexto es incompleto.

#### Scenario: Fallback MOCK para perifericos

- GIVEN no existe configuracion de terminal o el agent local no esta disponible
- WHEN un flujo intenta usar perifericos
- THEN el sistema SHALL usar fallback MOCK o error controlado
- AND SHALL NOT impedir guardar transacciones de negocio por fallo de perifericos.

### Requirement: Version and release visibility

El sistema SHALL exponer informacion de versionamiento suficiente para soporte y despliegue MVP.

#### Scenario: UI muestra version

- GIVEN un usuario autorizado accede al panel o layout principal
- WHEN consulta la informacion del sistema
- THEN la UI SHALL mostrar version, release o build disponible.

#### Scenario: Estado de migraciones visible o consultable

- GIVEN soporte tecnico necesita validar despliegue
- WHEN consulta estado de sistema
- THEN el sistema SHALL permitir identificar version de migraciones o estado equivalente
- AND SHALL NOT exponer secretos.

### Requirement: Operational audit trail

El sistema SHALL registrar trazabilidad operativa minima para acciones criticas del MVP WEB.

#### Scenario: Evento critico de negocio

- GIVEN un usuario ejecuta una accion critica como venta, compra, pedido, caja o inventario
- WHEN la accion se completa o falla
- THEN el sistema SHOULD registrar actor, tenant, sucursal, fecha, accion y resultado
- AND SHALL evitar datos sensibles innecesarios.

#### Scenario: Cambio de configuracion

- GIVEN un usuario autorizado cambia configuracion operativa
- WHEN el cambio se guarda
- THEN el sistema SHOULD registrar trazabilidad de cambio
- AND SHALL permitir soporte posterior.

### Requirement: Health monitoring

El sistema SHALL ofrecer validaciones de salud para servicios requeridos por el MVP WEB.

#### Scenario: Health API y DB

- GIVEN soporte tecnico consulta salud del sistema
- WHEN API y DB estan disponibles
- THEN el sistema SHALL reportar estado saludable
- AND SHALL reportar degradacion si DB o dependencias fallan.

#### Scenario: Health de perifericos MOCK

- GIVEN `backend-perifericos` esta disponible en modo MOCK
- WHEN soporte consulta health del agent
- THEN el sistema SHALL reportar `MOCK`
- AND SHALL mantener claro que no hay hardware real activo.

### Requirement: MVP final readiness decision

El sistema SHALL producir una decision final de salida MVP WEB.

#### Scenario: MVP listo

- GIVEN builds, tests, QA operativo, FE, reportería, monitoreo y evidencias pasan
- WHEN se ejecuta MVP-08
- THEN la evidencia SHALL recomendar `MVP_WEB_READY`.

#### Scenario: MVP bloqueado

- GIVEN existe un fallo critico, build roto, test roto, datos fiscales inconsistentes o QA operativo incompleto
- WHEN se ejecuta MVP-08
- THEN la evidencia SHALL recomendar `MVP_WEB_BLOCKED`
- AND SHALL explicar causa, impacto y pasos para desbloquear.

### Requirement: MVP restrictions

El sistema SHALL mantener fuera de alcance hardware real y plataformas desktop/mobile durante esta iniciativa.

#### Scenario: No hardware real

- GIVEN cualquier fase de `mvp-web-hardening`
- WHEN se implementa o valida un cambio
- THEN el equipo SHALL NOT conectar impresora real, scanner real, balanza real ni caja real
- AND SHALL NOT activar `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.

#### Scenario: No Electron or Capacitor

- GIVEN cualquier fase de `mvp-web-hardening`
- WHEN se implementa o valida un cambio
- THEN el equipo SHALL NOT integrar Electron ni Capacitor
- AND SHALL mantener el foco en MVP WEB.
