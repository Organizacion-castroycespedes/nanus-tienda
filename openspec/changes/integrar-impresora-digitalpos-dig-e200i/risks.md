## Risks

- El dialecto ESC/POS real puede no coincidir con el renderer actual.
- El encoding puede requerir ajuste para caracteres latinos y simbolos.
- El corte total o parcial puede variar por firmware.
- El cajon monedero puede requerir certificacion fisica separada.
- QR, barcode, imagenes y logo siguen sin evidencia fisica.
- La impresora usa DHCP, asi que un cambio de IP puede romper una configuracion fija.
- El puerto de consulta `4000` puede no ser un protocolo utilizable sin documentacion.
- Windows y Linux pueden comportarse distinto en la ruta de spooler o transporte.
- Un timeout de red demasiado corto puede generar falsos negativos.
- Un diseno que acople el navegador al socket de la impresora abriria riesgo de seguridad y CORS.
- Los defaults del formulario deben seguir siendo genericos; si se vuelven globales, XPrinter y registros historicos pueden quedar mal clasificados.
- El backend ya preserva Unicode y el preview real de `fetch()` llego intacto; el riesgo restante es la validacion fisica sobre el papel y cualquier code page que el firmware pudiera exigir.
- El preview de PowerShell puede mostrar U+FFFD aunque el backend preserve Unicode; esa herramienta no debe usarse como evidencia unica de corruption.
