## 1. Preparación y protección funcional

- [x] 1.1 Confirmar en `web/app/[tenant]/finance/page.tsx` los hooks, cálculos, permisos, CTA y rutas actuales que deben permanecer sin cambio semántico.
- [x] 1.2 Confirmar que no se requieren cambios en backend, base de datos, servicios, tipos, permisos ni submódulos financieros.

## 2. Composición visual POS-first

- [x] 2.1 Rediseñar el encabezado del padre con densidad compacta y conservar el CTA existente de abrir/cerrar caja o arqueo.
- [x] 2.2 Reemplazar el bloque duplicado de “Operación financiera base” por cuatro accesos rápidos compactos y role-aware; distribuir columnas según la cantidad visible.
- [x] 2.3 Reorganizar los KPI existentes en una grilla compacta basada en la cantidad visible, sin agregar métricas, cálculos ni consultas.
- [x] 2.4 Convertir “Últimos cierres y aperturas” en una lista operacional compacta con caja, código, estado y monto disponibles.
- [x] 2.5 Mantener accesible `/finance/current-shift` y verificar que los cuatro destinos principales conserven sus deep links.

## 3. Responsive y accesibilidad

- [x] 3.1 Aplicar `min-w-0`, grids adaptables y wrapping para evitar overflow horizontal global.
- [x] 3.2 Implementar composición local para header y KPI inline compactos; reutilizar `FinanceStatusBadge`, iconos, tokens y clases existentes sin modificar componentes compartidos.
- [x] 3.3 Verificar labels, foco, targets táctiles, estados vacíos y semántica de estado sin depender solo del color.

## 4. Validación

- [x] 4.1 Añadir o adaptar pruebas frontend focalizadas solo si existe cobertura aplicable para rutas, permisos, CTA y renderizado. No existe suite frontend conectada para esta página.
- [x] 4.2 Ejecutar web lint y web build; separar fallos preexistentes de regresiones.
- [x] 4.3 Ejecutar validación OpenSpec strict y `git diff --check`.
- [ ] 4.4 Completar QA manual en USER, ADMIN, SUPER_USER y SUPER_ADMIN, en móvil, POS aproximado 1024x768 y escritorio.
- [x] 4.5 Confirmar que no cambian backend, database, contratos, autorización ni comportamiento de los submódulos.
