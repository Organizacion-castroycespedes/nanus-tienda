## 1. Contrato común de fechas

- [x] 1.1 Implementar utilidad backend compartida para zona efectiva, `now` inyectable, medianoche local, intervalo semiabierto y metadatos de período.
- [x] 1.2 Implementar validación de fecha mínima de tres meses calendario, finales de mes, fechas futuras, rangos invertidos y precisión subsegundo.
- [x] 1.3 Reemplazar los normalizadores duplicados en POS, caja, compras y pedidos, manteniendo filtros, permisos, tenant, sucursal y semántica de caja.
- [x] 1.4 Aplicar el mismo contrato a ventas operativas y a solicitudes sin fechas explícitas.

## 2. Paridad de datasets y exportaciones

- [x] 2.1 Hacer que listas y documentos usen el mismo filtro efectivo antes de invocar adaptadores.
- [x] 2.2 Mantener exportación completa por lotes y snapshot `REPEATABLE READ`, verificando que PDF y Excel compartan filas y agregaciones.
- [x] 2.3 Incorporar período efectivo, zona horaria y generación a respuestas y plantillas PDF/Excel sin cambiar contratos transaccionales.
- [x] 2.4 Verificar que paginación de pantalla no altere totales ni conjunto exportado.

## 3. Frontend de reportes

- [x] 3.1 Centralizar rango inicial y límites del `DateRangePicker` para POS, caja, compras, pedidos y ventas operativas.
- [x] 3.2 Mostrar el mensaje exacto de validación para fechas fuera de tres meses, futuras o invertidas, evitando solicitudes inválidas.
- [ ] 3.3 Mostrar período efectivo, zona y generación en las seis vistas y conservar filtros adicionales.

## 4. Pruebas

- [x] 4.1 Agregar pruebas de ausencia de fechas, día actual, día histórico, rangos, medianoche, conversión Bogotá/UTC, subsegundo, tres meses, fin de mes, bisiesto, futuro e invertido.
- [ ] 4.2 Agregar pruebas de aislamiento tenant/sucursal, estados, permisos, paginación y rechazo antes de SQL.
- [ ] 4.3 Agregar pruebas de paridad de UUID, cantidades, totales, pagos y saldos entre pantalla, PDF y Excel usando snapshot controlado.

## 5. Validación

- [ ] 5.1 Ejecutar pruebas relevantes de `backend-reporteria` y `web`, registrando fallos preexistentes separados.
- [ ] 5.2 Ejecutar lint, typecheck y build con los scripts reales disponibles.
- [ ] 5.3 Ejecutar validación OpenSpec estricta y revisar el estado Git final sin tocar cambios locales preexistentes.
