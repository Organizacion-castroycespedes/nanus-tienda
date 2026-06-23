## 1. OpenSpec

- [x] 1.1 Crear proposal, design, tasks y spec delta del cambio.
- [x] 1.2 Validar `corregir-scroll-modal-detalle-domicilio` en modo strict.

## 2. Frontend

- [x] 2.1 Revisar `DeliveryDetailPanel.tsx` y el componente `Modal` usado.
- [x] 2.2 Agregar max-height responsive al modal de detalle.
- [x] 2.3 Agregar scroll vertical interno para contenido alto.
- [x] 2.4 Evitar overflow horizontal en grilla, textos y contenedores.
- [x] 2.5 Mantener acciones visibles o accesibles sin cambiar reglas funcionales.

## 3. QA

- [x] 3.1 Crear `docs/evidencia-qa-scroll-modal-detalle-domicilio.md`.
- [x] 3.2 Documentar QA manual desktop y movil, o dejar pendiente si no se ejecuta.
- [x] 3.3 Confirmar que backend, SQL, permisos, caja, POS, facturacion y pagos no fueron tocados.

## 4. Validacion

- [x] 4.1 Run `C:\nvm4w\nodejs\openspec.cmd validate corregir-scroll-modal-detalle-domicilio --type change --strict`.
- [x] 4.2 Run `C:\nvm4w\nodejs\openspec.cmd validate --all --strict`.
- [x] 4.3 Run `cd web && npm.cmd run lint`.
- [x] 4.4 Run `cd web && npm.cmd run build`.
- [x] 4.5 Run `git diff --check`.
