# Delta spec: role-navigation-permissions

## ADDED Requirements

### Requirement: Login redirects to dashboard

El login normal SHALL iniciar en el dashboard del tenant.

#### Scenario: Login exitoso

- GIVEN un usuario inicia sesion correctamente
- WHEN se crea la sesion frontend
- THEN la UI SHALL redirigir a `/{tenantId}/dashboard`
- AND SHALL NOT iniciar directamente en POS, caja, pedidos, compras o reportes.

#### Scenario: Force login exitoso

- GIVEN el usuario resuelve conflicto de sesion con force-login
- WHEN se crea la nueva sesion
- THEN la UI SHALL redirigir a `/{tenantId}/dashboard`.

### Requirement: Purchases permissions and navigation

El sistema SHALL alinear compras por rol en menu, rutas y API.

#### Scenario: ADMIN gestiona compras de su contexto

- GIVEN un `ADMIN` autenticado
- WHEN consulta menu, ruta o API de compras
- THEN SHALL poder operar dentro de su tenant y sucursal/contexto autorizado.

#### Scenario: SUPER_USER gestiona compras del tenant

- GIVEN un `SUPER_USER` autenticado
- WHEN consulta compras
- THEN SHALL poder gestionar compras de sucursales de su tenant autorizado.

#### Scenario: USER no recibe permisos nuevos de compras

- GIVEN un `USER` autenticado
- WHEN consulta menu o ruta de compras
- THEN compras SHALL estar oculto o bloqueado salvo permiso explicito existente
- AND la API SHALL rechazar acceso no autorizado.

### Requirement: Catalog administration permissions and navigation

El sistema SHALL alinear productos, unidades, impuestos y proveedores por rol.

#### Scenario: ADMIN gestiona catalogos permitidos

- GIVEN un `ADMIN` autenticado
- WHEN accede a productos, unidades, impuestos o proveedores
- THEN SHALL poder gestionar datos de su tenant/contexto autorizado
- AND estos modulos SHALL aparecer en menu.

#### Scenario: SUPER_USER gestiona catalogos del tenant

- GIVEN un `SUPER_USER` autenticado
- WHEN accede a productos, unidades, impuestos o proveedores
- THEN SHALL poder gestionar datos del tenant autorizado
- AND estos modulos SHALL aparecer en menu.

#### Scenario: USER no gestiona catalogos administrativos

- GIVEN un `USER` autenticado
- WHEN consulta menu o rutas administrativas de catalogos
- THEN productos, unidades, impuestos y proveedores administrativos SHALL estar ocultos o bloqueados salvo permiso explicito existente
- AND POS/catalog loading para venta SHALL seguir funcionando.

### Requirement: Promotions permissions and navigation

El sistema SHALL exponer promociones solo a roles autorizados por el modelo objetivo.

#### Scenario: SUPER_USER gestiona promociones

- GIVEN un `SUPER_USER` autenticado
- WHEN consulta menu, ruta o API de promociones
- THEN SHALL poder gestionar promociones del tenant autorizado.

#### Scenario: SUPER_ADMIN gestiona promociones segun alcance actual

- GIVEN un `SUPER_ADMIN` autenticado
- WHEN consulta promociones
- THEN SHALL respetar el alcance actual del sistema.

#### Scenario: USER y ADMIN sin promocion

- GIVEN un `USER` o un `ADMIN` sin permiso explicito de promociones
- WHEN intenta acceder por menu o ruta directa
- THEN promociones SHALL estar oculto o bloqueado
- AND la API SHALL rechazar acceso no autorizado.

### Requirement: Sidebar reflects role and operational state

El menu lateral SHALL reflejar permisos reales y estado operativo sin sustituir validacion backend.

#### Scenario: USER menu operativo

- GIVEN un `USER` autenticado
- WHEN el menu lateral carga
- THEN SHALL ver dashboard, POS sujeto a caja abierta, pedidos si tiene permiso, caja/turno y tickets propios/autorizados
- AND SHALL NOT ver compras, productos, unidades, impuestos, proveedores ni promociones sin permiso explicito.

#### Scenario: ADMIN menu operativo

- GIVEN un `ADMIN` autenticado
- WHEN el menu lateral carga
- THEN SHALL ver dashboard, POS sujeto a caja abierta, pedidos, compras, productos, unidades, impuestos, proveedores, caja/turno y tickets autorizados
- AND promociones SHALL quedar oculto salvo permiso/modelo actual.

#### Scenario: SUPER_USER menu operativo

- GIVEN un `SUPER_USER` autenticado
- WHEN el menu lateral carga
- THEN SHALL ver dashboard, POS sujeto a contexto/caja, pedidos, compras, productos, unidades, impuestos, proveedores, promociones, caja/turnos y reportes/tickets autorizados.

#### Scenario: Ruta directa no confia en menu

- GIVEN una opcion esta oculta o desactivada en menu
- WHEN un usuario intenta entrar por URL directa
- THEN la ruta y la API SHALL validar permiso y alcance de nuevo.

### Requirement: Manual QA evidence by role

El cambio SHALL registrar evidencia manual por rol.

#### Scenario: Evidencia local completa o parcial

- GIVEN se ejecutan validaciones locales por rol
- WHEN termina la fase de trabajo
- THEN `docs/evidencia-qa-mejoras-funcionales-operativas-caja-roles-menu.md` SHALL registrar fecha, rama, ambiente, roles, rutas, endpoints, builds/tests, OpenSpec, QA manual, pendientes, produccion no tocada y commit no realizado.
