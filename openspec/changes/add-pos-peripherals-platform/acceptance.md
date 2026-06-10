# Acceptance: add-pos-peripherals-platform

## Criterios de aceptacion funcionales

1. El diseno SHALL documentar registro de terminales POS por tenant y sucursal.
2. El diseno SHALL documentar registro de perifericos locales y simulados.
3. El diseno SHALL documentar asignacion de perifericos a terminales POS.
4. El diseno SHALL documentar impresion de prueba.
5. El diseno SHALL documentar apertura de caja registradora.
6. El diseno SHALL documentar lectura de peso desde balanza.
7. El diseno SHALL documentar lectura de QR/codigo de barras.
8. El diseno SHALL documentar consulta de estado de conexion.
9. El diseno SHALL documentar logs tecnicos.
10. El diseno SHALL documentar eventos WebSocket locales.

## Criterios de aceptacion tecnicos

1. El agent local SHALL exponer HTTP local.
2. El agent local SHALL exponer WebSocket local.
3. El agent local SHALL poder ejecutarse en la terminal POS.
4. El agent local SHALL soportar `MOCK/SIMULATOR`.
5. El agent local SHALL no depender del Backend API principal para operar hardware local.
6. El agent local SHALL permitir futura integracion con ESC/POS.
7. El agent local SHALL permitir futura integracion con serial/USB.
8. El agent local SHALL permitir futura integracion con HID keyboard.
9. El agent local SHALL reportar eventos al frontend POS.
10. Los contratos sugeridos SHALL quedar documentados en OpenSpec.

## Criterios de aceptacion de arquitectura

1. El Backend API principal SHALL seguir siendo dueno del negocio.
2. `backend-perifericos` SHALL ser dueno del hardware.
3. El frontend Manus POS SHALL NOT hablar directamente con hardware fisico.
4. Web POS, Electron y Capacitor SHALL tener responsabilidades separadas.
5. La facturacion electronica SHALL quedar fuera del agent local.
6. Ventas, inventario, caja, compras, usuarios, roles y permisos SHALL quedarse en Backend API principal.
7. No se SHALL crear acoplamiento entre drivers locales y modulos `api/`.
8. El modelo conceptual SHALL diferenciar terminales, dispositivos, asignaciones, logs, eventos y perfiles.

## Criterios de aceptacion de seguridad

1. El agent local SHALL documentar bind por defecto a `127.0.0.1`.
2. El agent local SHALL documentar token local o secreto efimero para comandos.
3. El agent local SHALL documentar CORS local restringido.
4. El agent local SHALL documentar limites de origen para Web POS y Electron.
5. El agent local SHALL documentar sanitizacion de logs tecnicos.
6. El agent local SHALL documentar que no guarda tickets completos por defecto en logs.
7. El agent local SHALL documentar proteccion para comandos sensibles como apertura de caja.
8. El agent local SHALL documentar que no expone endpoints de negocio.

## Criterios de aceptacion de QA

1. La validacion OpenSpec strict SHALL pasar.
2. `git diff --check` SHALL pasar.
3. `git status --short` SHALL mostrar solo artefactos OpenSpec esperados para este cambio.
4. No SHALL existir codigo funcional modificado.
5. No SHALL existir migraciones nuevas.
6. No SHALL existir dependencias instaladas.
7. No SHALL existir cambios en `api/`, `web/`, `database/` ni `backend-reporteria/`.
8. Las tareas SHALL quedar organizadas por fases con checklist verificable.

## Criterios de aceptacion para modo simulador

1. El modo `MOCK/SIMULATOR` SHALL permitir operar sin hardware real.
2. El modo `MOCK/SIMULATOR` SHALL simular impresora termica.
3. El modo `MOCK/SIMULATOR` SHALL simular caja registradora.
4. El modo `MOCK/SIMULATOR` SHALL simular balanza.
5. El modo `MOCK/SIMULATOR` SHALL simular scanner QR/codigo de barras.
6. El modo `MOCK/SIMULATOR` SHALL simular estados conectado, desconectado y error.
7. El modo `MOCK/SIMULATOR` SHALL emitir eventos WebSocket locales.
8. El modo `MOCK/SIMULATOR` SHALL registrar logs tecnicos sanitizados.

## Criterios de aceptacion para Electron

1. Electron Desktop POS SHALL quedar documentado como modalidad principal para caja fisica.
2. Electron SHALL comunicarse con agent local por HTTP/WebSocket local.
3. Electron SHALL mantener separado negocio y hardware.
4. Electron SHALL poder evaluar arranque o monitoreo del agent en fases futuras.
5. Empaquetado Electron real SHALL quedar fuera de alcance inicial.

## Criterios de aceptacion para Capacitor como evaluacion futura

1. Capacitor Android POS SHALL quedar documentado como evaluacion futura.
2. La evaluacion SHALL cubrir tablets, meseros, preventistas y terminales Android POS.
3. La evaluacion SHALL cubrir USB, serial, HID, Bluetooth, OTG y plugins nativos.
4. La evaluacion SHALL documentar permisos Android requeridos.
5. La evaluacion SHALL documentar limites y riesgos antes de comprometer implementacion Android.
6. Android nativo SHALL quedar fuera de alcance inicial.

## Criterios de cierre de esta fase

1. Se entregan solo documentos OpenSpec.
2. No se continua con implementacion hasta aprobacion humana.
3. La siguiente fase queda bloqueada hasta que el cambio OpenSpec sea revisado y aprobado.
