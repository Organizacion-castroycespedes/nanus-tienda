## 1. Inspección y guardas

- [x] 1.1 Confirmar rutas, hooks, servicios, permisos, formularios, modales, tablas, filtros y acciones existentes en las cinco vistas.
- [x] 1.2 Confirmar que el landing `/finance` queda fuera de cambios y que solo se requieren extensiones mínimas de consulta server-side en backend; database y lógica financiera no cambian.
- [x] 1.3 Confirmar consumidores de `FinancePageHeader`, `FinanceSectionNav` y `FinanceMetricCard` para preservar sus variantes default.

## 2. Variantes visuales compartidas

- [x] 2.1 Añadir variante compacta opcional a `FinancePageHeader`, conservando el default actual.
- [x] 2.2 Añadir variante compacta opcional a `FinanceSectionNav`, replicando la estructura horizontal de accesos del landing `/finance`, conservando rutas, active state y filtro de permisos, y derivando el grid de los items visibles.
- [x] 2.3 Añadir variante compacta opcional a `FinanceMetricCard`, conservando props, valores y semántica.

## 3. Homologación de módulos

- [x] 3.1 Aplicar shell compacto a `cash-sessions` sin alterar apertura, cierre, arqueo, historial, modales o acciones.
- [x] 3.2 Aplicar shell compacto a `cash-movements` sin alterar filtros, registro, cálculos o listado.
- [x] 3.3 Aplicar shell compacto a `cash-registers` sin alterar CRUD, asignaciones, relaciones o permisos.
- [x] 3.4 Aplicar shell compacto a `payment-methods` sin alterar tabs, CRUD, instituciones, estados o formularios.
- [x] 3.5 Reducir paneles, tablas/listas y filtros solo mediante presentación, manteniendo estados loading/error/empty y scroll interno.
- [x] 3.6 Adaptar grids a contenido visible y breakpoints POS/mobile/desktop sin user-agent detection ni columnas fantasma.
- [x] 3.7 Aplicar shell y resumen compacto a `current-shift`, eliminar la repetición visual de contexto y priorizar sus seis tabs operativos sin alterar datos, acciones o búsqueda.
- [x] 3.8 Compactar `Tu caja en este momento`, `Entregas por cajero` y `Gestión del turno` en `cash-sessions`, preservando datos, estados, acciones, tablas y handlers.
- [x] 3.9 Colapsar `Últimos movimientos` por defecto dentro de `Gestión del turno`, con toggle accesible y sin consulta adicional.

## 3.10 Consulta cash-movements bajo demanda

## 3.11 Scope operativo por rol

- [x] Reutilizar el servicio de scope de sucursales existente para resolver tenant y sucursales efectivas antes de listar sesiones abiertas en `current-shift`.
- [x] Permitir a ADMIN consultar sesiones abiertas de sus sucursales asignadas y mantener USER limitado a su propia sesiÃ³n o caja autorizada.
- [x] Mantener selecciÃ³n jerÃ¡rquica tenant/sucursal/usuario/sesiÃ³n en `current-shift` con resets de dependencias y filtros no confiables.
- [x] Agregar modo `Turno actual` en `cash-movements` usando `cashSessionId` para movimientos y pagos, manteniendo `HistÃ³rico` separado.
- [x] Aplicar scope de sucursal a ADMIN en `cash-movements` y validar que sesiÃ³n/caja seleccionadas pertenezcan a la sucursal autorizada.

- [x] Implementar rango obligatorio, filtros server-side y ausencia de carga histórica automática.
- [x] Separar tabs Movimientos y Métodos de pago con KPI ligados a la consulta ejecutada.
- [x] Agregar desglose histórico por pagos usando cash_session_id y scopes efectivos sin N+1.
- [x] Limitar inicialmente el historial de cash-sessions a sesiones OPEN en backend y agregar filtros explícitos de estado, fechas, sucursal, caja y usuario.

## 4. Validación y QA

- [x] 4.1 Ejecutar tests existentes relacionados con Finance y separar fallos preexistentes de regresiones. Backend Finance 22 PASS/1 SKIP; frontend Finance 3/3 PASS; no hay suite de páginas.
- [x] 4.2 Ejecutar frontend lint y build.
- [x] 4.3 Ejecutar OpenSpec strict y `git diff --check`.
- [ ] 4.4 Ejecutar QA manual de las cinco vistas en POS aproximado 1024x768, móvil y escritorio.
- [ ] 4.5 Verificar USER, ADMIN, SUPER_USER y SUPER_ADMIN cuando los perfiles estén disponibles.
- [x] 4.6 Confirmar diff final sin database, migraciones, autorización, lógica financiera, secretos ni artefactos; documentar el soporte backend mínimo de cash-movements y cash-sessions.
- [x] 4.7 Ejecutar tests/build afectados y validar rango, scopes y desglose histórico.
- [ ] 4.8 Repetir QA manual del historial de caja en POS, móvil y escritorio.

### 3.12 Historial con scope efectivo y secciÃ³n colapsable

- [x] Reutilizar `AccessControlService` para poblar sucursales autorizadas y evitar cargar el directorio global de usuarios en la pÃ¡gina.
- [x] Aplicar tenant -> sucursal -> usuario -> caja con resets dependientes para SUPER_ADMIN y mantener las restricciones de ADMIN, SUPER_USER y USER.
- [x] Mantener la intersecciÃ³n server-side de filtros de historial con `FinanceAccessRepository` y el estado inicial `OPEN`.
- [x] Colapsar por defecto Historial de caja con trigger accesible y sin solicitudes por toggle.

### 3.13 SelecciÃ³n contextual de sesiÃ³n abierta en cash-sessions

- [x] Reutilizar el resultado server-side de sesiones `OPEN` para poblar el contexto operativo sin descargar universos globales.
- [x] Mantener USER en su sesiÃ³n propia y mostrar selectores compactos solo a roles supervisores cuando existen alternativas autorizadas.
- [x] Implementar jerarquÃ­a tenant -> sucursal -> usuario -> sesiÃ³n con reset de dependencias y selecciÃ³n solo de sesiones `OPEN`.
- [x] Derivar `currentSession` y su resumen operativo de la sesiÃ³n seleccionada, sin cambiar cÃ¡lculos ni contratos mutativos.
- [x] Preservar condiciones existentes de Arqueo, `Entregar mi cierre`, cierre y demÃ¡s acciones; actualizar OpenSpec y dejar QA manual final pendiente.
