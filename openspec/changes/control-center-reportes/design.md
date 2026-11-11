## Context

Las fases 1 a 3b dejaron en el esquema `control_center` contratos con versiones, cargos (`charges`), recaudos con sus aplicaciones, avisos y alertas. Ya existen también el PDF del contrato con `pdfmake` y el emisor tomado del tenant plataforma, y el envío SMTP con `nodemailer`. La API ya depende de `exceljs` para importar inventario. El rol del Control Center ya puede leer todo lo que estos reportes necesitan.

## Goals / Non-Goals

**Goals:**

- Estado de cuenta claro para el cliente, consistente con la Cartera y fácil de enviar.
- Cuadre mensual de lo facturado frente a lo recaudado, exportable a Excel para conciliar con el banco.
- Lista accionable de vencimientos comerciales (pruebas, término inicial y renovaciones anuales).

**Non-Goals:**

- Contabilidad formal, facturación electrónica o integración con software contable.
- Reportes programados o envíos automáticos; todo se pide desde la pantalla.
- Gráficas avanzadas: las tablas y los totales son suficientes en esta fase.
- Ingresos recurrentes (MRR) ni efectividad de recordatorios: quedan para una fase posterior.

## Decisions

### D1. Estado de cuenta

- **Endpoints:**
  - `GET accounts/:id/statement?from=AAAA-MM-DD&to=AAAA-MM-DD` devuelve el PDF. Por defecto `to` es hoy (Bogotá) y `from` es `to` menos 12 meses. Se rechaza un rango invertido o mayor a 36 meses.
  - `POST accounts/:id/statement/send` con `{ from?, to? }` lo envía como adjunto al `billing_email` de la cuenta. Si el correo no está listo o la cuenta no tiene un correo válido, responde 422.
- **Datos, en una función de consulta pura y probada:**
  - **Cargos:** los que no están anulados y vencen dentro del rango, más todos los que tienen saldo, aunque venzan antes. Por cada uno: número, contrato, concepto y período, vencimiento, total, pagado, saldo, estado y días de mora a la fecha de corte.
  - **Pagos:** los recaudos confirmados del rango (`PAYMENT` y `PRORATION_CREDIT`), con número, fecha, medio o "Crédito por prorrateo", referencia, valor, aplicado y saldo a favor.
  - **Resumen:**
    - facturado en el período (suma de los cargos que vencen en el rango);
    - pagado en el período (suma de los recaudos `PAYMENT` del rango);
    - saldo pendiente total y vencido a la fecha de corte;
    - saldo a favor total.
- **Documento:**
  - Encabezado del emisor compartido con el PDF del contrato: se extrae `issuerHeader` y se lee el emisor con `loadIssuer`.
  - Título "Estado de cuenta" con el período y la fecha de corte, y datos del cliente.
  - Resumen, tabla de cargos y tabla de pagos.
  - Instrucciones de pago de `CONTROL_CENTER_PAYMENT_INSTRUCTIONS` y pie con página.
- **Nombre del archivo:** `estado-cuenta-<NIT>-<desde>-<hasta>.pdf`.
- **Correo:**
  - Asunto "MANUS: estado de cuenta de <cliente>", con cuerpo corto en texto y HTML y el PDF adjunto.
  - `EmailMessage` admite `attachments` (nombre, contenido y tipo) y `SmtpEmailSender` los pasa a `nodemailer`.
- **Auditoría:** `ACCOUNT_STATEMENT_DOWNLOADED` y `ACCOUNT_STATEMENT_SENT`, con el rango y, en el envío, el destinatario y el resultado.

### D2. Facturado frente a recaudado

- **Endpoint:** `GET reports/billing-collections?from=AAAA-MM&to=AAAA-MM`, con 12 meses hasta el mes actual por defecto y un máximo de 24 meses.
- **Totales de cada mes:**
  - **Facturado:** suma de `total_amount` de los cargos no anulados según su mes de vencimiento (`due_date`), separada en período, prorrateo y pago único.
  - **Recaudado:** suma de los recaudos `PAYMENT` confirmados según su mes de pago (`received_on`), también desglosada por medio de pago (snapshot del código y nombre).
  - **Créditos de prorrateo:** suma de los recaudos `PRORATION_CREDIT` confirmados.
  - **Diferencia:** facturado menos recaudado.
  - **Totales del rango** y **saldo pendiente actual** de los cargos del rango.
- **Montos:** se calculan en SQL con `numeric` y se devuelven como texto; los meses se formatean en la API.
- **Excel:** `GET reports/billing-collections.xlsx` con el mismo rango, generado con `exceljs`.
  - Hoja *Resumen mensual*: una fila por mes, una columna por medio de pago y una fila de totales.
  - Hoja *Cargos*: el detalle de los cargos del rango.
  - Hoja *Pagos*: el detalle de los recaudos del rango, con entidad y referencia para conciliar.
  - Formato de moneda colombiana, encabezados fijos y filtro automático.
- **Auditoría:** `REPORT_EXPORTED`.

### D3. Renovaciones y pruebas por vencer

- **Endpoint:** `GET reports/renewals?days=30|60|90`, con 30 por defecto. Considera los contratos `ACTIVE` y tres tipos de evento:
  - **`TRIAL_END`:** la prueba de la primera versión termina entre hoy y hoy + `days`.
  - **`INITIAL_TERM_END`:** la versión vigente es de término inicial. El fin se calcula como el inicio de facturación más `initial_term_months` de la versión de precio de origen, con el ajuste a fin de mes. Se incluye si cae en la ventana.
  - **`ANNUAL_RENEWAL`:** la versión vigente es una renovación anual y el próximo período anual inicia en la ventana.
- **Las renovaciones mensuales no se listan:** se renuevan cada mes.
- **Datos de cada fila:**
  - contrato, cliente y tenant;
  - tipo de evento, fecha y días restantes;
  - frecuencia y valor actual de la versión vigente;
  - valor de renovación mensual y anual con el catálogo vigente del plan a la fecha del evento, calculado con `buildContractItems` en fase `RENEWAL` y las mismas terminales adicionales;
  - si ya existe una versión futura, el evento se marca como "Renovación registrada".
- **Orden:** por fecha.

### D4. Web

- **Pestaña Reportes** (`/control-center/reports`), nueva en el `ControlCenterShell`:
  - **Renovaciones:** selector de 30, 60 o 90 días y tabla con enlace a la ficha.
  - **Facturado frente a recaudado:** selector de rango de meses, tabla por mes con totales y desglose por medio de pago, y botón "Exportar Excel".
  - **Estado de cuenta:** selector de cuenta y diálogo.
- **Diálogo "Estado de cuenta"** (rango de fechas, Descargar PDF y Enviar por correo): se abre desde Reportes, desde las cuentas y desde la Cartera por cuenta.

## Risks / Trade-offs

- **Criterio de mes.** Lo facturado se cuenta por mes de vencimiento y lo recaudado por mes de pago; un pago anticipado aparece en un mes distinto al de su cargo. Se explica en la pantalla y en el Excel.
- **Valor de renovación.** Es una estimación con el catálogo vigente; los ajustes de precio del contrato se definen al renovar.
- **Tamaño del estado de cuenta.** Con muchos cargos el PDF ocupa varias páginas, y la tabla repite el encabezado en cada una.

## Migration Plan

No hay migraciones. Los reportes se despliegan con la API y la web. El envío por correo requiere el SMTP de la fase 3.

## Open Questions

Ninguna.
