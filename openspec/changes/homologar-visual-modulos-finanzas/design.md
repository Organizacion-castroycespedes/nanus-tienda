## Context

El scope operativo se resuelve antes de consultar datos: `current-shift` reutiliza `ReportBranchScopeService` para obtener tenant y sucursales efectivas; los filtros del cliente solo intersectan ese resultado. `cash-movements` valida la sucursal de una sesiÃ³n seleccionada y en `Turno actual` usa el mismo `cashSessionId` para movimientos y pagos. `HistÃ³rico` conserva rango obligatorio y agregaciÃ³n por fechas.

El landing `/finance` ya usa una composición local compacta con header tipo `/reporteria`, accesos pequeños, KPI inline y grids basados en elementos visibles. Las cuatro vistas especializadas y `current-shift` deben compartir esa densidad; `current-shift` además repite visualmente el contexto de caja antes del resumen y la operación del turno.

La inspección confirmó que las cinco páginas mantienen su propia lógica de estado y acciones, pero comparten componentes visuales Finance y primitives del design system. Las fuentes de datos, hooks, servicios, permisos, formularios, modales, tablas y handlers deben permanecer intactos.

## Goals / Non-Goals

**Goals:**

- Homologar las cinco vistas especializadas con el baseline visual certificado de `/finance`.
- Dar prioridad operacional a Ventas, Pedidos, Compras, Movimientos, Arqueo y Tickets en `current-shift`, después del contexto y resumen compactos del turno.
- Compactar en `cash-sessions` las superficies `Tu caja en este momento`, `Entregas por cajero` y `Gestión del turno`, preservando datos y acciones y reduciendo únicamente espacio visual redundante.
- Reducir altura de header, navegación, KPI, toolbars, filtros y superficies principales.
- Mantener acciones críticas claras: abrir/cerrar/arqueo, nuevo movimiento, crear/editar caja, crear método/banco y acciones por fila.
- Usar grids `auto-fit` o clases derivadas de contenido visible, sin columnas fantasma.
- Conservar accesibilidad, badges de estado, loading/error/empty y overflow controlado.
- Mantener defaults de componentes compartidos para no afectar rutas no incluidas.

**Non-Goals:**

- No modificar el landing `/finance`.
- No cambiar comportamiento de `/finance/current-shift`; su alcance visual incluye compactar contexto, resumen, tabs, búsqueda y contenido existente.
- No cambiar apertura, cierre, arqueo, movimientos, CRUD, asignaciones, métodos, permisos o datos.
- No modificar database, migraciones, seeds, autorización ni reglas financieras. `cash-movements` y `cash-sessions` extienden mínimamente DTO, repository y service para soportar filtros server-side y agregación segura por pagos.
- No agregar filtros, acciones, campos, dependencias ni tablas nuevas.

## Decisions

1. **Variantes visuales opcionales compartidas.** Añadir props visuales opcionales a `FinancePageHeader`, `FinanceSectionNav` y `FinanceMetricCard`. Los defaults actuales permanecen iguales; las cinco vistas usarán la variante compacta donde corresponda. Alternativa descartada: duplicar headers/nav/KPI, porque produciría divergencia visual.

2. **Header compacto sin card hero.** La variante compacta renderiza eyebrow, título, descripción y acciones en un header con divisor y espaciado corto, alineado con `/reporteria`. Los children de `actions` y sus handlers permanecen sin cambios.

3. **Navegación compacta con el mismo contrato.** `FinanceSectionNav` conserva items, rutas, active state y filtro de Métodos de pago; su variante compacta replica la composición real del landing: enlace horizontal con icono azul, label/descripción truncables y flecha `ArrowRight`, con active state sutil. Las columnas se derivan de la cantidad real de items visibles, sin depender del rol ni dejar columnas fantasma.

4. **KPI densos.** La variante compacta de `FinanceMetricCard` conserva `label`, `value`, `accent` y `helper`, pero reduce padding, tamaño tipográfico y altura. Los grids de cada página usan `repeat(auto-fit,minmax(...))` cuando el conjunto de métricas no es fijo.

5. **Paneles y listados compactos por página.** Reducir únicamente clases de presentación en toolbars, filtros, cards de resumen, tablas/listas y bloques de estados. No cambiar expresiones, handlers, filtros, callbacks, componentes de formulario ni datos renderizados.

6. **Responsive CSS.** POS alrededor de 1024x768 recibe varias columnas cuando caben; móvil baja a una o dos columnas. Tablas mantienen `overflow-x-auto` interno existente; no se introduce user-agent detection ni ancho fijo global.

7. **Superficies operacionales de sesiones.** `cash-sessions` mantiene contexto de caja, métricas, entregas por cajero, acciones de arqueo/entrega, movimientos recientes y estados existentes; solo reduce padding, gaps, radios y densidad de filas para acercar la operación al primer viewport.

8. **Movimientos recientes bajo demanda.** El bloque `Últimos movimientos` dentro de `Gestión del turno` usa un estado UI local contraído por defecto. El trigger conserva el contador disponible en memoria y expande exactamente los registros ya cargados; `Ver movimientos` continúa siendo el acceso completo independiente.

9. **Consulta de movimientos bajo demanda.** `/finance/cash-movements` no carga histórico al montar. El operador debe indicar `dateFrom` y `dateTo` y ejecutar `Buscar`; el backend valida el rango de hasta 31 días, aplica fechas, sucursal, caja, dirección y tipo server-side, y devuelve el listado y sus KPI para el mismo universo.

10. **Tabs y pagos históricos.** `Movimientos` es la vista inicial. `Métodos de pago` usa una agregación única sobre `payments`, unida a `cash_sessions` cuando se filtra caja, y aplica `cash_session_id`, rango temporal y scopes de actor. No se inventan categorías de domicilio: solo se muestran referencias reales (`SALE`, `SALES_ORDER`, compras/egresos) disponibles en la fuente.

11. **Historial de caja operativo.** `/finance/cash-sessions` consulta inicialmente solo `status=OPEN` en backend. Estado, sucursal, caja, usuario y fechas se envían como filtros explícitos al endpoint existente; cambiar controles no muta resultados hasta `Buscar`. Estados distintos de `OPEN` requieren un rango de fechas de máximo 31 días usando límites por fecha sobre `opened_at`; `Limpiar` vuelve a `OPEN` sin fechas.

## Risks / Trade-offs

- [Variantes compartidas podrían afectar otros consumidores] → Mantener props opcionales con default idéntico y usar compact solo en las cinco rutas objetivo.
- [Menor espacio puede apretar acciones críticas] → Mantener `Button`, `Modal`, `RowActionsMenu` y textos de acción; revisar targets en POS y móvil.
- [Tablas anchas en POS] → Conservar scroll interno de tablas y reducir solo padding; no ocultar datos funcionales sin evidencia.
- [Diferencias de permisos cambian cantidad de navegación] → Reutilizar `canViewPaymentMethods` y los checks existentes; nunca agregar elementos para llenar filas.

## Migration Plan

No hay migración. Desplegar frontend y los cambios mínimos de backend de esta fase. Rollback: revertir los archivos de aplicación; no requiere cambios de datos.

## Open Questions

14. **Sesión operativa seleccionada.** `cash-sessions` mantiene el comportamiento propio de USER y usa el resultado server-side de sesiones `OPEN` autorizadas como catálogo contextual para ADMIN, SUPER_USER y SUPER_ADMIN. La jerarquía visual es tenant (solo SUPER_ADMIN), sucursal, usuario y sesión; cada cambio limpia dependencias incompatibles. La sesión seleccionada alimenta el resumen y las superficies operativas existentes mediante `currentSession` y su resumen ya autorizado. Arqueo, entrega y cierre conservan sus guards y condiciones actuales; seleccionar una sesión no crea permisos mutativos.

12. **Scope y densidad del historial.** Las sucursales vienen del endpoint existente protegido por `AccessControlService`; las cajas se solicitan con tenant/sucursal seleccionados y el endpoint de sesiones vuelve a intersectar filtros con `FinanceAccessRepository`. Las opciones de usuario se derivan solo de sesiones retornadas dentro de ese scope. SUPER_ADMIN puede cambiar tenant; al cambiarlo se limpian sucursal, usuario y caja. ADMIN no ve sucursales fuera de sus asignaciones; SUPER_USER no recibe selector de tenant; USER conserva controles utiles para su alcance.
13. **Historial colapsable.** `Historial de caja / Cierres y sesiones registradas` inicia colapsado. Un `button` con `aria-expanded`, `aria-controls`, foco visible y chevron controla solo renderizado local. Expandir no limpia filtros, reemplaza resultados ni dispara `loadHistory`; al reabrir conserva los datos cargados.

- QA manual debe confirmar densidad en 1024x768, móvil y escritorio para las cinco vistas, con prioridad operacional de los seis tabs de `current-shift`.
- QA debe verificar cada acción existente por rol sin declarar PASS solo por compilación.
