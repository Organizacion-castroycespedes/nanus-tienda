## 1. Renderer y contrato

- [x] 1.1 Extraer renderer ESC/POS térmico puro con ancho seguro de 48 columnas, wrapping e importes alineados.
- [x] 1.2 Hacer que NETWORK RAW use el renderer compartido sin cambiar su contrato HTTP.
- [x] 1.3 Exponer capacidades veraces de transporte y corte físico.

## 2. USB RAW Windows

- [x] 2.1 Agregar transporte USB RAW por spooler Windows usando solo la cola descubierta.
- [x] 2.2 Agregar selección explícita RAW/GDI y errores controlados sin fallback silencioso.
- [x] 2.3 Mantener GDI legado solo como fallback configurado y declarar corte físico no disponible.

## 3. Tests y evidencia

- [x] 3.1 Cubrir layout térmico, wrapping, importes y bytes ESC/POS/CUT.
- [x] 3.2 Cubrir USB RAW exitoso, error controlado y fallback GDI configurado.
- [x] 3.3 Actualizar evidencia QA con causa, configuración RAW, limitaciones y checklist de hardware.
- [x] 3.4 Ejecutar tests, build, OpenSpec estricto y `git diff --check`.

## 4. Correccion QA de secuencia final

- [x] 4.1 Reemplazar feed final minimo por avance ESC/POS suficiente antes de CUT.
- [x] 4.2 Cubrir orden binario BODY -> FOOTER -> FINAL FEED -> CUT.
- [x] 4.3 Ejecutar validaciones tecnicas posteriores y actualizar evidencia QA.

## 5. QA hardware y certificacion

- [x] 5.1 Registrar QA hardware XP-80 USB RAW y corte fisico como PASS.
- [x] 5.2 Reiniciar Agent con certificacion habilitada y confirmar una impresion final.
