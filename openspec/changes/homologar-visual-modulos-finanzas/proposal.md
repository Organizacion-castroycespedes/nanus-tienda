## Why

Esta fase tambiÃ©n debe resolver el scope operativo de sesiÃ³n en servidor. Los filtros de tenant, sucursal, usuario, caja o sesiÃ³n solo reducen el alcance efectivo del actor. ADMIN queda limitado a sus sucursales asignadas; USER a su propia sesiÃ³n o caja autorizada; SUPER_USER al tenant autorizado; SUPER_ADMIN al alcance global permitido. El modo HistÃ³rico de movimientos conserva sus fechas y filtros server-side.

Los módulos especializados de Finanzas todavía usan headers tipo hero, navegación grande, KPI altos y paneles con demasiado espacio para una operación POS. El landing `/finance` ya tiene una identidad compacta y certificada; esta fase lleva esa identidad a sesiones, movimientos, cajas, métodos de pago y turno actual sin tocar su lógica.

## What Changes

- Homologar encabezados, navegación Finance, KPI, superficies, filtros, tablas/listas, badges y estados con el baseline visual del landing `/finance`.
- Reducir altura y espacio muerto en `/finance/cash-sessions`, `/finance/cash-movements`, `/finance/cash-registers` y `/finance/payment-methods`.
- Adaptar grids de KPI y navegación a los elementos realmente visibles y a los breakpoints POS, móvil y escritorio.
- Mantener intactas apertura, cierre, arqueo, movimientos, CRUD, asignaciones, métodos, permisos, hooks, servicios, contratos y navegación.
- Reutilizar variantes visuales opcionales de componentes Finance compartidos cuando el default permanezca intacto para evitar regresiones.
- Mantener `/finance` como baseline integrado y dejar fuera de alcance cualquier nueva modificación de su landing.

## Capabilities

### New Capabilities

- `finance-specialized-visual-homogenization`: Identidad visual compacta y responsive para las cinco vistas especializadas Finance.

### Modified Capabilities

No se modifican capacidades funcionales ni contratos existentes.

## Impact

- `cash-sessions` permite seleccionar una sesión abierta autorizada para roles supervisores; todos los datos operativos visibles siguen esa sesión seleccionada.
- La selección contextual reutiliza el endpoint existente con `status=OPEN`; no agrega endpoints, descargas globales ni permisos mutativos nuevos.

- El historial de caja respeta el scope efectivo: USER conserva su alcance, ADMIN usa solo sucursales asignadas, SUPER_USER solo su tenant y SUPER_ADMIN puede cambiar tenant dentro de su alcance global.
- La secciÃ³n Historial de caja inicia colapsada; expandir es estado UI local y conserva filtros/resultados sin ejecutar consultas adicionales.

- Páginas frontend de `cash-sessions`, `cash-movements`, `cash-registers` y `payment-methods`.
- Variantes visuales opcionales de componentes Finance compartidos, sin cambiar sus defaults ni semántica.
- Nuevos artefactos OpenSpec de esta fase.
- No hay cambios en base de datos, migraciones ni lógica financiera. Se extienden mínimamente los servicios existentes de `cash-movements` y `current-shift` para intersectar filtros con el scope efectivo por tenant/sucursal/usuario/sesión; no se crea un segundo sistema de permisos ni endpoints nuevos.
