## Context

Manus POS Electron ya funciona como shell desktop online para Windows. Carga la web existente, resuelve contexto local `MANUS_*` y cuenta con empaquetado Windows inicial.

La siguiente decision tecnica no debe ser integrar hardware de inmediato, sino definir limites. Los perifericos POS tienen riesgos de driver, permisos del sistema operativo, modelos de fabricante, seguridad y efectos operativos. Esta fase documenta la estrategia sin tocar runtime.

Discovery inicial:

| Item | Resultado |
| --- | --- |
| Rama | `feat/0.0.1/arquitectura-clientes-web-electron` |
| Worktree | Limpio |
| HEAD inicial | `1839ed0` |
| Electron package | Sin SDKs de perifericos POS. |
| Empaquetado | Windows `dir` ya validado en fase previa. |

## Goals / Non-Goals

**Goals:**

- Definir estrategia futura de perifericos POS Windows para Electron.
- Separar renderer web, preload y main process.
- Documentar recomendaciones iniciales por periferico.
- Mantener backend/API como autoridad de negocio.
- Definir seguridad minima para APIs de hardware futuras.
- Definir QA hardware futuro.

**Non-Goals:**

- No implementar hardware real.
- No instalar SDKs ni librerias de perifericos.
- No implementar ESC/POS.
- No abrir puertos seriales, USB, HID ni red.
- No modificar POS, caja, pedidos, facturacion ni productos pesables.
- No modificar backend, SQL, permisos ni contratos API.
- No implementar offline ni sync.
- No modificar empaquetado funcional.

## Decisions

### 1. Lector de codigo de barras por HID teclado primero

Decision: recomendar lector en modo teclado HID como primer enfoque.

Rationale: la mayoria de lectores inyectan texto y Enter en el input activo. No requiere API Electron, permisos USB ni drivers especiales.

Alternativa considerada: USB/serial directo desde Electron. Se deja futuro porque requiere permisos, mapping de dispositivos y manejo de errores.

### 2. Impresion inicial por sistema Windows o navegador controlado

Decision: para v0.0.1, recomendar impresion via navegador/web o impresora instalada en Windows. `webContents.print` queda como siguiente paso Electron controlado.

Rationale: reduce integracion nativa. Permite validar tickets sin abrir ESC/POS ni drivers directos.

Alternativa considerada: ESC/POS directo. Se deja futuro porque implica comandos binarios, modelos de impresora, codificacion, corte de papel y gaveta.

### 3. Gaveta no debe abrir desde renderer web sin control

Decision: la gaveta futura debe abrirse mediante Electron main/preload o agent local controlado, nunca mediante Node expuesto al renderer.

Rationale: abrir caja es un efecto fisico sensible. Debe estar ligado a evento operativo valido y auditado.

Alternativa considerada: abrir por boton web directo. Se descarta porque permitiria abuso o ejecucion fuera de flujo.

### 4. Bascula queda futura y especifica por protocolo

Decision: bascula se analiza como integracion futura por serial/USB/protocolo de fabricante, con lectura manual como fallback.

Rationale: requiere estabilidad de lectura, unidades, tara, calibracion, certificacion y compatibilidad fisica.

Alternativa considerada: alterar POS ahora para productos pesables. Se descarta por alcance y riesgo operativo.

### 5. Impresora fiscal queda categoria regulada futura

Decision: impresora fiscal no entra en v0.0.1. Se documenta como integracion dependiente de pais, proveedor y SDK certificado.

Rationale: puede afectar facturacion fiscal/electronica, numeracion, autorizaciones y cumplimiento legal.

### 6. APIs futuras estrechas en preload

Decision: cualquier API futura de hardware debe exponerse como metodos especificos en preload, con `contextIsolation` activo y `nodeIntegration` desactivado.

Rationale: mantiene aislamiento del renderer y evita exponer Node completo o ejecucion arbitraria.

## Risks / Trade-offs

| Riesgo | Mitigacion |
| --- | --- |
| Hardware cambia por fabricante | Crear matriz por modelo probado en QA futuro. |
| Drivers Windows fallan o cambian | Validar por version de Windows, driver y puerto. |
| Impresion silenciosa puede abusarse | Requerir configuracion explicita y permisos futuros. |
| Gaveta puede abrirse sin venta valida | Asociar comando futuro a evento operativo confirmado. |
| Bascula puede enviar lectura inestable | Definir protocolo de estabilidad, tara y unidad antes de usar peso. |
| Fiscal puede ser regulatorio | Tratarlo como proyecto separado con proveedor certificado. |

## Migration Plan

No hay migracion de datos ni despliegue funcional.

Pasos:

1. Crear OpenSpec change documental.
2. Crear documento de arquitectura de perifericos POS Windows.
3. Enlazar la fase desde documentos Electron relacionados.
4. Crear evidencia QA documental.
5. Ejecutar OpenSpec strict y `git diff --check`.

Rollback: revertir documentos y OpenSpec del change. No hay codigo, SQL ni dependencias que revertir.

## Open Questions

- Si la primera impresion Electron sera `webContents.print` o ESC/POS directo.
- Si se usara Electron main/preload solamente o un `backend-perifericos`/agent local como capa aparte.
- Que modelos de impresora, gaveta, lector y bascula se certificaran primero.
- Que paises requieren impresora fiscal fisica y cuales usan solo facturacion electronica/API.
