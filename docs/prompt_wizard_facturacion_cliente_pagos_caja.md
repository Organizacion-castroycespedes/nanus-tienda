# Prompt — Wizard previo para facturar remisión con actualización de cliente y medios de pago

## Contexto

La funcionalidad de facturación de una venta/remisión YA EXISTE y actualmente se ejecuta de forma directa desde:

```text
Ventas -> Facturar
```

No se debe reescribir esa lógica ni reemplazar el proceso fiscal existente.

El cambio requerido es agregar un paso previo tipo wizard que permita:

1. revisar/actualizar los datos del cliente;
2. revisar los medios de pago;
3. opcionalmente corregir los medios de pago dentro del mismo proceso;
4. ejecutar al final la funcionalidad de facturación ya existente.

La corrección de medios de pago solo debe permitirse cuando exista una caja/turno válido abierto, porque puede afectar el cuadre financiero.

No introducir una arquitectura artificial con:

```ts
mode: 'SALE' | 'INVOICE_REMISSION'
```

No duplicar el modal de cobro completo.

---

# 1. Flujo objetivo

Cambiar:

```text
Ventas
  ↓
Facturar
  ↓
Facturación directa
```

por:

```text
Ventas
  ↓
Facturar
  ↓
Wizard de datos para facturación

Paso 1 — Cliente
  ↓
Paso 2 — Medios de pago
  ↓
Paso 3 — Confirmación
  ↓
Función de facturación EXISTENTE
```

---

# 2. Regla principal

Facturar una venta ya cerrada NO debe:

- crear otra venta;
- descontar inventario otra vez;
- crear un segundo pago;
- generar movimientos de caja si no hubo cambios de pago;
- exigir caja abierta solamente para facturar.

La caja/turno se exige únicamente si el usuario desea modificar información financiera del pago y esa modificación puede afectar el cuadre.

---

# 3. Auditoría obligatoria antes de implementar

Trabajar desde un worktree basado en `develop`.

```bash
git fetch origin
git worktree add ../wt-preinvoice-wizard -b feat/preinvoice-wizard origin/develop
```

Auditar primero:

1. handler actual del botón `Facturar`;
2. función/hook/servicio que ejecuta la facturación;
3. endpoint actual;
4. componente de cliente usado en `Cobrar venta`;
5. componente de medios de pago;
6. reglas de referencia;
7. pagos múltiples;
8. caja activa;
9. turno/jornada activa;
10. movimientos de caja;
11. relación pago ↔ venta;
12. permisos;
13. auditoría existente;
14. comportamiento de consumidor final;
15. lógica de Factucore/DIAN.

Crear:

```text
docs/preinvoice-wizard-audit.md
```

No tocar todavía el flujo fiscal hasta terminar esta auditoría.

---

# 4. Wizard

Crear un componente sencillo:

```text
PreInvoiceWizard
```

con tres pasos.

No reutilizar el modal de cobro completo.

Sí reutilizar componentes internos ya desacoplados.

Ejemplo:

```text
PreInvoiceWizard
 ├── CustomerStep
 ├── PaymentStep
 └── ConfirmationStep
```

---

# 5. Paso 1 — Cliente

Título:

```text
Datos del cliente
```

Permitir:

- revisar cliente actual;
- buscar cliente;
- reemplazar consumidor final por cliente fiscal;
- actualizar datos;
- completar información fiscal.

Usar los componentes y endpoints existentes.

No inventar nuevos campos.

Tomar los requeridos por el contrato real del sistema.

---

# 6. Guardado del cliente

Si el usuario modifica el cliente:

```text
Guardar cambios
```

Debe persistir antes de avanzar.

Ejemplo conceptual:

```ts
if (customerDirty) {
  await updateCustomer();
  await refreshSale();
}
```

No esperar hasta el final para guardar todos los cambios juntos si eso dificulta conocer el estado real.

---

# 7. Paso 2 — Medios de pago

Título:

```text
Medios de pago
```

Cargar exactamente los pagos registrados en la venta.

Ejemplo:

```text
Efectivo
$100.000

Transferencia
$99.124,05
Referencia: 984512
```

Por defecto mostrar la información en lectura.

---

# 8. Editar pagos dentro del mismo wizard

Sí se permite corregirlos dentro del mismo proceso.

Agregar acción:

```text
Modificar medios de pago
```

No habilitar edición automáticamente al entrar al paso.

---

# 9. Validación previa para editar pagos

Cuando el usuario pulse:

```text
Modificar medios de pago
```

consultar el estado real de caja/turno.

NO confiar únicamente en estado local.

Ejemplo conceptual:

```ts
const financialContext = await getCurrentFinancialContext();
```

Respuesta conceptual:

```ts
{
  shiftOpen: true,
  cashSessionOpen: true,
  cashRegisterId: "...",
  terminalId: "..."
}
```

---

# 10. Regla para habilitar la edición

Permitir modificar medios de pago solo si se cumplen las condiciones financieras reales.

Como mínimo:

```text
turno/jornada activa
+
caja activa
```

si el sistema actual requiere ambos.

No asumir nombres.

Usar las reglas ya implementadas.

Si no existe caja válida:

```text
Los medios de pago no pueden modificarse porque no hay una caja abierta.
Puedes continuar con la facturación usando el pago registrado.
```

El usuario aún debe poder seguir a:

```text
Confirmación
```

sin editar pagos.

---

# 11. No bloquear la factura por no tener caja

Esta diferencia debe quedar estrictamente definida.

```text
FACTURAR
```

NO requiere caja abierta.

```text
MODIFICAR PAGOS
```

SÍ puede requerir caja abierta.

Por lo tanto:

```text
Caja cerrada
   ↓
Cliente editable
Pago solo lectura
Factura permitida
```

y:

```text
Caja abierta
   ↓
Cliente editable
Pago editable
Factura permitida
```

---

# 12. Reutilización del componente de pago

Antes de crear UI nueva revisar si el actual flujo de cobro ya tiene algo como:

```text
PaymentMethods
PaymentMethodSelector
PaymentInput
PaymentReference
SplitPayment
```

Reutilizar estos bloques.

No duplicar:

- catálogo de métodos;
- validaciones;
- iconos;
- reglas de referencia;
- pagos múltiples;
- redondeos;
- cambio;
- límites.

---

# 13. Modo edición financiera local al wizard

No agregar un modo global al sistema.

El wizard puede manejar simplemente:

```ts
const [editingPayments, setEditingPayments] = useState(false);
```

y:

```ts
const canEditPayments =
  financialContext.shiftOpen &&
  financialContext.cashSessionOpen;
```

Esto es estado local del wizard, no una nueva arquitectura de checkout.

---

# 14. Reglas al cambiar el pago

Cuando el usuario cambie:

```text
Efectivo -> Transferencia
```

o:

```text
Transferencia -> Efectivo
```

o cambie una combinación de pagos:

```text
Efectivo + Débito
```

el sistema debe recalcular el efecto financiero.

No resolver esto únicamente en frontend.

El backend debe validar:

```text
pago anterior
pago nuevo
diferencia
afectación caja
movimientos compensatorios
```

---

# 15. Cruzar toda la información necesaria

Antes de guardar una corrección de pago obtener y validar:

```text
venta
pagos originales
caja original
turno original
caja actual
turno actual
terminal
sucursal
usuario
tenant
total venta
total pagos
cambio
referencias
```

No asumir que la venta fue creada en la misma caja actualmente abierta.

---

# 16. Caja original vs caja actual

Este punto debe auditarse especialmente.

Ejemplo:

```text
Venta original:
Caja 1
Turno A
ayer

Usuario actual:
Caja 2
Turno B
hoy
```

No debe modificarse el pago histórico como si perteneciera automáticamente a la caja actual.

El backend debe definir la política.

Opciones válidas:

### Política A — corrección mediante ajustes

Crear movimientos compensatorios en la caja actual.

### Política B — no permitir corrección en otra caja

Exigir coincidencia con caja/terminal correspondiente.

### Política C — permiso administrativo

Permitir corrección con trazabilidad especial.

No decidir esto arbitrariamente en frontend.

Documentarlo en la auditoría.

---

# 17. Mantener cuadre de caja

Toda modificación de pago debe dejar consistente:

```text
total venta
=
suma de pagos
```

y cualquier movimiento de efectivo debe conservar el cuadre.

Ejemplo:

Venta:

```text
$199.124,05
```

Antes:

```text
Efectivo: $199.124,05
```

Después:

```text
Transferencia: $199.124,05
```

No basta con cambiar el campo `payment_method`.

Debe revisarse qué movimiento de efectivo quedó registrado originalmente.

Si había una entrada en caja, debe existir la operación compensatoria correspondiente.

---

# 18. No borrar historia financiera

No hacer:

```sql
UPDATE payments
SET method = 'TRANSFER'
```

sin conservar trazabilidad.

Preferir la estrategia real existente del proyecto.

Si no existe, diseñar:

```text
payment correction
```

con:

```text
before
after
reason
user
date
cash context
```

---

# 19. Motivo obligatorio

Si se cambia el pago solicitar:

```text
Motivo de corrección *
```

Ejemplo:

```text
El cliente pagó por transferencia y se registró como efectivo por error.
```

Guardar en auditoría.

---

# 20. Permiso

La capacidad de:

```text
Modificar medios de pago
```

debe depender de un permiso.

Buscar primero uno existente.

Si no existe, crear uno siguiendo el patrón del proyecto.

Ejemplo conceptual:

```text
sales.payment.correct
```

No asumir que cualquier usuario que puede facturar puede corregir caja.

---

# 21. Guardado del pago

Al confirmar la modificación:

```text
Guardar cambios de pago
```

el frontend debe enviar la intención.

El backend decide:

- si es válida;
- si exige caja;
- qué movimientos compensatorios crear;
- cómo actualizar auditoría.

Después:

```ts
await savePaymentCorrection();
await refreshSale();
```

---

# 22. Refrescar después de cambios

Después de cambiar cliente o pagos:

```text
GET detalle venta
```

o la consulta equivalente.

No usar los datos antiguos cargados desde la tabla.

El paso de confirmación debe trabajar con información persistida y actualizada.

---

# 23. Paso 3 — Confirmación

Mostrar un resumen:

```text
Cliente
Luis Ramos
CC ...

Pago
Transferencia
$199.124,05
Referencia: ...

Total venta
$199.124,05

Facturación
Sin solicitar
```

Botón:

```text
Emitir factura
```

---

# 24. Ejecución final

Al pulsar:

```text
Emitir factura
```

usar la MISMA función que actualmente usa `Facturar`.

Ejemplo conceptual:

```ts
await existingInvoiceAction(sale.id);
```

No crear otro endpoint de facturación si ya existe.

---

# 25. Orden del proceso

Ejemplo:

```ts
async function handleFinishWizard() {
  if (customerDirty) {
    await saveCustomer();
  }

  if (paymentsDirty) {
    await savePaymentCorrection();
  }

  await refreshSale();

  await existingInvoiceAction(sale.id);
}
```

Idealmente cliente y pagos se guardan en sus propios pasos, por lo que al final solo se refresca y factura.

---

# 26. Control de errores

Si falla cliente:

```text
No fue posible guardar los datos del cliente.
```

No avanzar.

Si falla pago:

```text
No fue posible actualizar los medios de pago.
```

No facturar.

Si la caja se cerró entre validación y guardado:

```text
La caja ya no se encuentra abierta. No fue posible modificar el pago.
```

La validación final debe ocurrir nuevamente en backend.

---

# 27. Condición de carrera con caja

No basta con validar caja cuando se abre el paso.

Ejemplo:

```text
07:55 caja abierta
07:57 usuario edita
07:58 caja cerrada
07:59 guardar
```

El backend debe rechazar la corrección.

La validación de caja/turno debe ejecutarse dentro de la misma operación/transacción que modifica los pagos.

---

# 28. Transacción backend

La corrección financiera debe ejecutarse transaccionalmente.

Conceptualmente:

```text
BEGIN

validar venta
validar caja
validar turno
bloquear registros necesarios
leer pago anterior
calcular diferencia
crear movimientos compensatorios
actualizar/corregir pago
registrar auditoría

COMMIT
```

Ante error:

```text
ROLLBACK
```

No dejar:

```text
pago actualizado
pero caja sin ajustar
```

---

# 29. Bloqueos/concurrencia

Considerar dos usuarios corrigiendo la misma venta.

Aplicar estrategia existente:

```text
row lock
version
optimistic locking
```

o equivalente.

No permitir dos correcciones simultáneas inconsistentes.

---

# 30. Casos de negocio a probar

## Caso 1 — Caja cerrada

```text
Facturar
cliente editable
pago solo lectura
emitir factura
```

Resultado:

```text
OK
```

---

## Caso 2 — Caja abierta, sin modificar pago

```text
Facturar
cliente actualizado
pago sin cambios
emitir
```

Resultado:

```text
sin movimiento adicional de caja
```

---

## Caso 3 — Caja abierta, cambiar referencia

```text
Transferencia
referencia ABC -> XYZ
```

Backend determina si solo cambia metadata.

Resultado:

```text
sin movimiento monetario si corresponde
auditoría registrada
```

---

## Caso 4 — Efectivo -> Transferencia

Requiere validar:

```text
entrada original de efectivo
ajuste/reverso
nuevo método
```

Resultado:

```text
caja cuadrada
```

---

## Caso 5 — Transferencia -> Efectivo

Debe validar ingreso a caja actual según política.

Resultado:

```text
nuevo movimiento financiero consistente
```

---

## Caso 6 — Pago dividido

Antes:

```text
Efectivo       100.000
Transferencia   99.124,05
```

Después:

```text
Débito         199.124,05
```

Validar compensación completa.

---

## Caso 7 — Caja se cierra mientras edita

Backend rechaza.

La venta permanece con pago anterior.

No se factura automáticamente.

---

# 31. No regresión

El cambio NO debe afectar:

```text
POS -> Cobrar venta
```

ni:

```text
crear venta
imprimir
descargar ticket
Factucore
inventario
```

salvo los puntos estrictamente necesarios.

---

# 32. Pruebas técnicas

Agregar:

### Frontend

- abrir wizard;
- actualizar cliente;
- caja cerrada -> pagos readonly;
- caja abierta -> botón modificar disponible;
- permiso ausente -> botón oculto/deshabilitado;
- guardar corrección;
- refrescar venta;
- emitir usando función existente.

### Backend

- corrección con caja abierta;
- corrección con caja cerrada;
- turno cerrado;
- cambio con movimiento de efectivo;
- cambio sin movimiento;
- concurrencia;
- rollback;
- auditoría;
- tenant;
- permisos.

---

# 33. Prueba de cuadre

Tomar una caja con:

```text
saldo inicial
ventas
efectivo
transferencias
```

realizar una corrección.

Verificar que:

```text
saldo esperado caja
=
saldo calculado
```

antes y después.

No aceptar únicamente pruebas de API.

Validar el efecto real sobre arqueo/cierre.

---

# 34. Criterios de aceptación

La tarea termina cuando:

- `Facturar` abre wizard;
- el cliente puede revisarse y actualizarse;
- el pago se muestra en el mismo wizard;
- la corrección de pago es opcional;
- con caja cerrada el pago queda solo lectura;
- con caja abierta puede habilitarse edición si el usuario tiene permiso;
- backend vuelve a validar caja/turno al guardar;
- cualquier cambio financiero mantiene el cuadre;
- existe auditoría;
- después de cambios se refresca la venta;
- el último paso usa la facturación existente;
- facturar sin tocar pagos no requiere caja abierta;
- no se duplica venta;
- no se duplica pago;
- no se afecta inventario;
- no se rompe el cobro normal.

---

# Regla de diseño

Separar claramente:

```text
editar datos para facturar
```

de:

```text
alterar información financiera
```

Ambas cosas pueden vivir dentro del mismo wizard, pero no tienen las mismas reglas.

El wizard es una capa previa a la facturación existente.

No reemplaza el flujo financiero ni el flujo fiscal.
