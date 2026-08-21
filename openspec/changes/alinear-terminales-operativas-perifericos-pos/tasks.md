## 1. Inventario y contrato de transición

- [x] 1.1 Generar y revisar un inventario por tenant/sucursal de `terminals`, `pos_terminals` y `pos_terminal_peripheral_settings` antes de cualquier backfill.
- [x] 1.2 Aprobar explícitamente cada mapeo de configuración legado hacia una terminal operativa; no inferir `local-terminal -> TERM-001` solo por compartir sucursal.
- [x] 1.3 Publicar el contrato de identidades: `operationalTerminalId`, `posTerminalId`, `agentTerminalCode` y `deviceId`.

## 2. Modelo de datos aditivo

- [x] 2.1 Crear, tras aprobación, una migración idempotente que agregue `pos_terminals.operational_terminal_id` nullable, FK a `terminals(id)`, índice y unicidad parcial.
- [x] 2.2 Añadir la validación de tenant y sucursal para impedir asociaciones entre terminales de ámbitos distintos.
- [x] 2.3 Aplicar el backfill aprobado de forma transaccional y conservar perfiles legados sin mapeo, incluido `local-terminal`.
- [x] 2.4 Documentar y probar el rollback de la relación aditiva sin modificar ventas, caja ni sesiones POS.

## 3. Resolución de configuración de periféricos

- [x] 3.1 Resolver primero `terminals.id` válido dentro del tenant y sucursal solicitados.
- [x] 3.2 Obtener el perfil `pos_terminals` enlazado y sus `pos_terminal_peripheral_settings` para la terminal operativa.
- [x] 3.3 Devolver estado controlado de terminal operativa sin impresora (`PRINTER_NOT_CONFIGURED`) sin caer a `local-terminal`.
- [x] 3.4 Mantener la búsqueda por código legado y el fallback MOCK solo para contexto explícitamente MOCK o de desarrollo.
- [x] 3.5 Exponer en `resolve-current` los identificadores sin sobrecargar `terminalId`.

## 4. Administración y cliente

- [ ] 4.1 Actualizar `/config/terminals` para mostrar o enlazar la configuración de periféricos de la terminal operativa.
- [x] 4.2 Actualizar `/admin/peripherals` para mostrar la terminal operativa asociada y el Agent code del perfil, sin presentarlo como otra terminal comercial.
- [x] 4.3 Mantener el `agentTerminalCode` como identificador local del Agent y obtener el `printerDeviceId` únicamente desde configuración persistida.
- [ ] 4.4 Eliminar de los flujos reales los defaults frontend `local-terminal` y `mock-printer-001`; conservarlos solo en fixtures/contextos MOCK explícitos.

## 5. Pruebas y QA

- [x] 5.1 Probar que `TERM-001` resuelve su configuración y la XP-80 sin caer a `local-terminal`.
- [x] 5.2 Probar que una terminal operativa sin periféricos devuelve `PRINTER_NOT_CONFIGURED` y no altera ventas, pagos, inventario ni caja.
- [x] 5.3 Probar que MOCK explícito conserva los fixtures y que terminales de otra sucursal o tenant no acceden a periféricos ajenos.
- [x] 5.4 Ejecutar regresión de sesiones POS, ventas, caja, Reportería POS y la impresión directa XP-80 USB.
- [x] 5.5 Registrar la evidencia de migración, compatibilidad temporal y plan de retiro del bridge `local-terminal`.

## 6. Ejecución incremental controlada

- [x] 6.1 Agregar al runner oficial un modo que seleccione exactamente una migración `V###__*.sql` con hard guard QA, checksum e historial reutilizado.
- [x] 6.2 Agregar validación automatizada mínima para selección única, path traversal, checksum, already applied, fallo y rechazo QA/producción.
- [x] 6.3 Ejecutar el dry-run real de V071 contra QA y registrar la evidencia sin aplicar cambios.
- [x] 6.4 Separar la identidad DDL seleccionada de la identidad runtime y probar la conexión `manus_qa_user`.
