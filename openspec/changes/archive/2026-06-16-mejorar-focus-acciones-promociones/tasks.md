## 1. Analisis

- [x] 1.1 Revisar implementacion actual del modulo de Promociones.
- [x] 1.2 Identificar modales existentes de crear/editar y accion de desactivar.
- [x] 1.3 Identificar componentes reutilizables y logica que no debe cambiar.

## 2. Implementacion

- [x] 2.1 Extraer contenido de modal a `PromotionFormPanel`.
- [x] 2.2 Implementar estado de accion activa.
- [x] 2.3 Integrar `FocusActionLayout`.
- [x] 2.4 Ocultar listado/filtros durante accion activa.
- [x] 2.5 Agregar mecanismo cancelar/regresar.
- [x] 2.6 Agregar `ConfirmDialog` success post crear/editar.
- [x] 2.7 Agregar feedback success para desactivar.
- [x] 2.8 Mantener manejo actual de errores.
- [x] 2.9 Mantener contratos API actuales.

## 3. Validacion

- [x] 3.1 Ejecutar `openspec.cmd validate mejorar-focus-acciones-promociones --type change --strict`.
- [x] 3.2 Ejecutar `openspec.cmd validate --all --strict`.
- [x] 3.3 Ejecutar `npm.cmd run build` en `web`.
- [x] 3.4 Ejecutar tests cercanos si existen.
- [x] 3.5 Ejecutar `git diff --check`.
- [x] 3.6 Ejecutar `git status --short`.
- [x] 3.7 Documentar QA manual o pendiente real sin inventar PASS.

Nota tests cercanos: no se encontro script de tests frontend en `web/package.json` distinto de `build`, `dev`, `start` y `lint`. No hay test especifico de Promociones para ejecutar.

Nota QA manual: PASS visual manual reportado por usuario en navegador local.

## 4. QA visual manual PASS

- [x] Abrir modulo Promociones.
- [x] Crear promocion.
- [x] Confirmar foco UX.
- [x] Cancelar creacion y volver al listado.
- [x] Guardar creacion.
- [x] Confirmar `Promocion creada correctamente`.
- [x] Editar promocion.
- [x] Confirmar foco UX.
- [x] Cancelar edicion y volver al listado.
- [x] Guardar edicion.
- [x] Confirmar `Promocion actualizada correctamente`.
- [x] Desactivar promocion de prueba.
- [x] Confirmar panel destructivo enfocado.
- [x] Confirmar `Promocion desactivada correctamente`.
- [x] Validar mobile.
