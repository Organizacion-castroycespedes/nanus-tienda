### Descripción
Corrección de UX en el manejo de conectividad y estados offline de Manus POS, eliminando mensajes de error técnicos e invasivos (ej. `Failed to fetch`), e implementando un manejo unificado del estado de la red.

### Áreas modificadas
- [x] web
- [x] desktop
- [ ] api
- [ ] backend-reporteria
- [ ] database

### Cambios principales
- **Electron (main.ts)**: Se eliminó el fondo azul/negro inicial configurando `backgroundColor: "#ffffff"` e implementando una pantalla nativa de carga rápida. Se simplificó la pantalla offline removiendo detalles técnicos.
- **OfflineIndicator.tsx**: Se agregó el estado `SERVICE_UNAVAILABLE` y se eliminó el texto hardcodeado "Backend". Ahora despacha un evento `manus:backend-restored` cuando el servidor se recupera.
- **PosScreen.tsx**: Se interceptaron los errores de red en la cotización de carrito. Ahora mantiene el producto visible con el mensaje "Precio pendiente de actualización", evitando que se desplieguen múltiples "toasts" rojos. Re-cotiza de forma automática los ítems pendientes al recuperar la conexión.

### Pasos manuales o dependencias (ENV / SQL)
- N/A
