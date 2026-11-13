## 1. Prerrequisitos

- [x] 1.1 Confirmar con el propietario el alcance de los reportes 1, 2 y 4, el formato y la entrega.
- [x] 1.2 Crear la rama desde `develop` (con el cierre fusionado) y registrar el ownership en `openspec-scope.json`.

## 2. API

- [x] 2.1 Encabezado del emisor compartido (`issuerHeader`, `loadIssuer`) y adjuntos en `EmailSender`.
- [x] 2.2 Estado de cuenta: consulta, documento PDF, descarga, envío por correo y auditoría, con pruebas.
- [x] 2.3 Facturado frente a recaudado: consulta mensual, desglose por medio, Excel con `exceljs` y auditoría, con pruebas.
- [x] 2.4 Renovaciones: eventos de prueba, término inicial y renovación anual, valores de renovación con `buildContractItems`, con pruebas.

## 3. Web

- [x] 3.1 Pestaña Reportes con renovaciones y facturado frente a recaudado (exportar Excel).
- [x] 3.2 Diálogo Estado de cuenta (rango, descargar y enviar) desde Reportes, Cuentas y Cartera.

## 4. Verificación

- [x] 4.1 `openspec validate control-center-reportes --strict` y gobernanza STRICT.
- [x] 4.2 QA local con los datos existentes y evidencia en `docs/evidencia-control-center-reportes.md`.
