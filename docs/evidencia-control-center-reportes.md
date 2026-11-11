# Evidencia: MANUS Control Center, reportes

OpenSpec: `control-center-reportes` · Rama: `feature/develop/control-center-reportes` · Fecha: 2026-11-10

## Alcance

- **Estado de cuenta en PDF**:
  - `GET accounts/:id/statement?from&to`, por defecto los últimos 12 meses y hasta 36 meses;
  - `POST accounts/:id/statement/send`, que envía el PDF adjunto al `billing_email` por el SMTP configurado;
  - cargos del rango y todos los pendientes con días de mora, pagos y créditos, resumen (facturado, pagado, pendiente, vencido, a favor) e instrucciones de pago;
  - encabezado del emisor compartido con el PDF del contrato;
  - auditoría `ACCOUNT_STATEMENT_DOWNLOADED` y `ACCOUNT_STATEMENT_SENT`.
- **Facturado frente a recaudado**:
  - `GET reports/billing-collections?from&to=AAAA-MM`, por defecto 12 meses y hasta 24;
  - facturado por mes de vencimiento y por tipo; recaudado por mes de pago y por medio; créditos de prorrateo; diferencia; pendiente del rango;
  - `GET reports/billing-collections.xlsx` con `exceljs` (hojas *Resumen mensual*, *Cargos* y *Pagos*) y auditoría `REPORT_EXPORTED`.
- **Renovaciones y pruebas por vencer**:
  - `GET reports/renewals?days=30|60|90`;
  - eventos de fin de prueba, fin del término inicial (inicio de facturación más `initial_term_months` de la versión de precio) y renovación anual; las renovaciones mensuales no se listan;
  - días restantes, valor actual y valores de renovación anual y mensual (más la certificación aparte) con el catálogo vigente;
  - marca de renovación ya registrada.
- **Web**:
  - pestaña **Reportes** (renovaciones, facturado frente a recaudado con exportación a Excel);
  - diálogo **Estado de cuenta** (rango, descargar, enviar por correo) desde Reportes, Cuentas y Cartera.
- **Correo**: `EmailMessage` admite adjuntos.
- Sin migraciones.

## Pruebas unitarias del módulo `reports`

7 de 7 pasan:

- rangos por defecto y límites;
- resumen y documento del estado de cuenta;
- agrupación mensual por vencimiento, pago y medio;
- libro de Excel con tres hojas y totales iguales a los de pantalla;
- eventos de renovación (término inicial a 28 días, prueba, renovación registrada, renovación anual y exclusión de la mensual);
- valores de renovación con el catálogo.

## Muestra real con la base local

Generada con los servicios de la API desde el agente local:

- **Estado de cuenta** de CARIBBEAN BEER LICORES SAS (`estado-cuenta-902067003-2025-11-11-2026-11-10.pdf`):
  - facturado $1.547.123 = $850.000 + $349.041 + $348.082;
  - pagado $1.199.041;
  - pendiente $348.082; vencido $0, porque vence el mismo día del corte;
  - saldo a favor $0.
- **Excel** `facturado-vs-recaudado-2025-12-2026-11.xlsx`:
  - totales iguales al reporte: facturado $1.547.123, recaudado $1.199.041 (todo por Transferencias) y diferencia $348.082.
- **Renovaciones a 90 días**: vacío, lo cual es correcto. `MCC-2026-00003` termina su término inicial el 08/11/2027 y su prueba ya terminó.

El propietario revisó el PDF y el Excel generados.
