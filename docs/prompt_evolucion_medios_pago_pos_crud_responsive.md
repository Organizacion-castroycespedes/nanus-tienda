# PROMPT COMPLETO — EVOLUCIÓN DEL MÓDULO "COBRAR VENTA" + CRUD DE MEDIOS DE PAGO

## Objetivo

Quiero evolucionar de forma completa el flujo de **Cobrar venta** del POS.

No quiero empezar por mover botones o cambiar CSS.

Lo primero es **planear el modelo funcional y técnico completo**, empezando por:

1. modelo de base de datos;
2. catálogo de medios de pago;
3. bancos y billeteras;
4. imágenes / iconos / logos;
5. reglas de visibilidad;
6. CRUD administrativo;
7. backend/API;
8. integración con el POS;
9. responsive desktop / tablet / mobile;
10. pruebas.

El resultado debe ser mantenible, configurable y reutilizable.

No quiero bancos quemados directamente en el frontend.

No quiero lógica duplicada por dispositivo.

No quiero que cada medio de pago tenga comportamiento hardcodeado dentro del JSX.

---

# 1. PRIMERA FASE: AUDITORÍA Y PLANEACIÓN

Antes de tocar código:

- revisar la arquitectura actual;
- identificar frontend POS;
- identificar backend;
- revisar modelo actual de ventas;
- revisar cómo se guardan los pagos;
- revisar cómo se representa actualmente:
  - efectivo;
  - débito;
  - crédito;
  - transferencia;
  - QR;
  - PSE;
- revisar si existe catálogo de medios de pago;
- revisar si existe tabla de bancos;
- revisar si existe configuración por empresa / tenant;
- revisar si existe configuración por terminal;
- revisar si existe configuración por sucursal;
- revisar si los métodos están quemados en frontend;
- revisar DTOs;
- revisar servicios;
- revisar migraciones;
- revisar permisos;
- revisar componentes administrativos existentes.

No asumir.

Primero documentar cómo funciona hoy.

Entregar antes de implementar:

```txt
Estado actual
Modelo actual
Problemas encontrados
Modelo propuesto
Cambios de BD
Cambios de backend
Cambios de frontend
Impactos
Riesgos
Plan de implementación
```

---

# 2. MODELO DE DATOS PROPUESTO

Diseñar un catálogo configurable.

## payment_methods

Campos sugeridos:

```txt
id
code
name
description
icon
color
requires_reference
requires_financial_institution
supports_change
allows_partial_payment
active
sort_order
created_at
updated_at
```

Ejemplos:

```txt
CASH
DEBIT_CARD
CREDIT_CARD
TRANSFER
QR
PSE
```

No depender del nombre visible para la lógica.

Usar `code` estable.

---

# 3. INSTITUCIONES FINANCIERAS

Crear catálogo separado.

## financial_institutions

Campos sugeridos:

```txt
id
code
name
short_name
type
logo
active
sort_order
created_at
updated_at
```

Tipos posibles:

```txt
BANK
WALLET
PAYMENT_NETWORK
OTHER
```

Ejemplos:

```txt
BANCOLOMBIA
NEQUI
DAVIPLATA
DAVIVIENDA
BANCO_DE_BOGOTA
BBVA
BANCO_POPULAR
BANCO_AV_VILLAS
SCOTIABANK
ITAU
BANCO_AGRARIO
OTHER
```

No guardar el logo como dependencia externa si el POS debe funcionar offline.

Preferir assets locales o archivos administrados por el sistema.

---

# 4. RELACIÓN MÉTODO DE PAGO — INSTITUCIÓN

No todos los medios de pago deben mostrar bancos.

Crear relación configurable.

## payment_method_financial_institutions

```txt
id
payment_method_id
financial_institution_id
active
sort_order
```

Ejemplo:

```txt
EFECTIVO
→ no tiene instituciones

DÉBITO
→ normalmente no necesita selector de banco

CRÉDITO
→ normalmente no necesita selector de banco

TRANSFERENCIA
→ sí puede mostrar bancos / billeteras

QR
→ puede mostrar solo entidades compatibles

PSE
→ puede mostrar instituciones compatibles
```

No renderizar selector bancario si el método no lo requiere.

---

# 5. CONFIGURACIÓN POR EMPRESA

Evaluar si cada tenant puede decidir:

- qué métodos están habilitados;
- cuáles bancos aparecen;
- orden de visualización;
- icono personalizado;
- si requiere referencia;
- si permite pago parcial;
- si aplica por sucursal;
- si aplica por terminal;
- si se muestra en POS.

Si el sistema ya es multiempresa, considerar:

## tenant_payment_methods

```txt
id
tenant_id
payment_method_id
enabled
requires_reference_override
sort_order
```

Y si hace falta:

## tenant_financial_institutions

```txt
id
tenant_id
financial_institution_id
enabled
sort_order
```

No agregar tablas innecesarias si la arquitectura actual ya resuelve esto.

Primero auditar.

---

# 6. IMÁGENES, ICONOS Y LOGOS

Definir una estrategia consistente.

## Reglas

- no usar URLs externas como dependencia crítica;
- no usar imágenes enormes;
- preferir SVG o WebP optimizado;
- mantener tamaño uniforme;
- tener fallback visual;
- evitar logos deformados;
- usar ícono genérico cuando no exista logo.

Ejemplo de fallback:

```txt
Banco no configurado
→ icono genérico de banco

Billetera sin logo
→ icono genérico de wallet
```

No bloquear el cobro por falta de imagen.

---

# 7. CRUD ADMINISTRATIVO — MEDIOS DE PAGO

Crear o evolucionar un módulo administrativo.

## Pantalla: Medios de pago

Debe permitir:

- listar;
- buscar;
- filtrar activos/inactivos;
- ordenar;
- crear;
- editar;
- activar/desactivar;
- configurar icono;
- configurar color si aplica;
- configurar si requiere referencia;
- configurar si requiere institución financiera;
- configurar si permite pago parcial;
- configurar si soporta cambio;
- configurar orden de aparición.

Ejemplo:

```txt
Medios de pago

[ Buscar... ]

Código         Nombre          Referencia    Banco    Estado
CASH           Efectivo        Sí            No       Activo
TRANSFER       Transferencia   Sí            Sí       Activo
QR             QR              Sí            Sí       Activo
PSE            PSE             Sí            Sí       Activo
```

---

# 8. CRUD ADMINISTRATIVO — BANCOS Y BILLETERAS

Crear pantalla:

```txt
Bancos y billeteras
```

Debe permitir:

- crear;
- editar;
- activar/desactivar;
- logo;
- tipo;
- nombre;
- código;
- orden;
- vincular a métodos de pago.

Ejemplo:

```txt
Bancolombia
Tipo: Banco
Logo: [imagen]
Activo: Sí

Disponible para:
[x] Transferencia
[x] QR
[x] PSE
[ ] Efectivo
[ ] Débito
[ ] Crédito
```

No permitir configuraciones absurdas sin advertencia.

---

# 9. PERMISOS

Revisar modelo de roles.

Sugerencia:

```txt
payment_methods.read
payment_methods.create
payment_methods.update
payment_methods.toggle

financial_institutions.read
financial_institutions.create
financial_institutions.update
financial_institutions.toggle
```

Solo roles administrativos deben cambiar esta configuración.

El cajero solo consume la configuración.

---

# 10. API / BACKEND

Diseñar endpoints reutilizables.

Ejemplo conceptual:

```txt
GET /payment-methods
GET /payment-methods/pos

GET /financial-institutions
GET /payment-methods/:id/financial-institutions
```

Administración:

```txt
POST   /payment-methods
PUT    /payment-methods/:id
PATCH  /payment-methods/:id/status

POST   /financial-institutions
PUT    /financial-institutions/:id
PATCH  /financial-institutions/:id/status
```

No cambiar contratos existentes sin revisar impacto.

Si ya existe un módulo equivalente, reutilizarlo.

---

# 11. PAYLOAD DE VENTA

Revisar cómo se envían los pagos hoy.

La estructura debe poder representar pago mixto.

Ejemplo conceptual:

```json
{
  "payments": [
    {
      "paymentMethodId": 1,
      "amount": 30000,
      "reference": "ABC123",
      "financialInstitutionId": null
    },
    {
      "paymentMethodId": 4,
      "amount": 25000,
      "reference": "TRX8899",
      "financialInstitutionId": 2
    }
  ]
}
```

No copiar este formato literalmente si el contrato actual es diferente.

Adaptarlo a la arquitectura existente.

---

# 12. REFERENCIA

El número de referencia debe seguir siendo:

# OBLIGATORIO

No cambiar esta regla.

UI:

```txt
Número de referencia *
```

No usar:

```txt
Referencia (opcional)
```

Validar antes de confirmar.

Error:

```txt
Ingresa el número de referencia.
```

Sin `alert()`.

---

# 13. REGLAS DE VISUALIZACIÓN EN POS

La interfaz debe ser contextual.

## Efectivo

Mostrar:

```txt
Monto
Número de referencia *
```

No mostrar:

- bancos;
- billeteras;
- QR;
- PSE.

## Débito

Mostrar:

```txt
Monto
Número de referencia *
```

No mostrar selector de bancos por defecto.

## Crédito

Mostrar:

```txt
Monto
Número de referencia *
```

No mostrar selector de bancos por defecto.

## Transferencia

Mostrar:

```txt
Banco o billetera
Monto
Número de referencia *
```

Mostrar instituciones configuradas.

## QR

Mostrar solo instituciones compatibles.

No mostrar bancos que no estén asociados al método.

## PSE

Mostrar instituciones configuradas para PSE.

No asumir que todas aplican.

---

# 14. DISEÑO DESKTOP

Desktop debe mantener modal centrado.

No fullscreen.

Referencia:

```txt
>= 1280px
```

Ancho sugerido:

```txt
1100px - 1200px
```

Distribución:

```txt
┌─────────────────────────────────────────────────────────────┐
│ Cobrar venta                                            X   │
│ Registra los medios de pago...                              │
├───────────────────────────────────────┬─────────────────────┤
│ Cliente de la venta                   │ Resumen de pago     │
│ [ CONSUMIDOR_FINAL ]                  │                     │
│ [Cliente fiscal] [Consumidor final]   │ Total a cobrar      │
│                                       │ $55.000             │
│ Método de pago #1                     │                     │
│                                       │ Total pagado        │
│ Efectivo | Débito | Crédito           │ Cambio              │
│ Transferencia | QR | PSE              │ Saldo pendiente     │
│                                       │                     │
│ Banco/billetera SOLO SI APLICA        │ Caja activa         │
│                                       │                     │
│ Monto          Número referencia *    │                     │
│                                       │                     │
│ + Agregar método de pago              │                     │
├───────────────────────────────────────┴─────────────────────┤
│                              Cancelar | Confirmar venta      │
└─────────────────────────────────────────────────────────────┘
```

Mantener:

- espacios limpios;
- no saturar;
- resumen fijo a la derecha;
- tarjetas pequeñas;
- no hacer controles gigantes.

---

# 15. TABLET

## Regla importante

Tablet NO debe verse como desktop reducido.

Debe adaptarse realmente.

## Tablet vertical

Referencia:

```txt
768px - 1024px
```

Debe usar panel casi fullscreen.

Distribución preferida:

```txt
┌──────────────────────────────┐
│ Cobrar venta              X  │
├──────────────────────────────┤
│ Cliente                      │
│ [CONSUMIDOR_FINAL]           │
│                              │
│ Total a cobrar               │
│ $55.000                      │
├──────────────────────────────┤
│ Método de pago               │
│                              │
│ Efectivo | Débito | Crédito  │
│ Transfer | QR | PSE          │
├──────────────────────────────┤
│ Banco / billetera            │
│ SOLO SI APLICA               │
├──────────────────────────────┤
│ Monto                        │
│ Número de referencia *       │
├──────────────────────────────┤
│ Total pagado                 │
│ Cambio                       │
│ Saldo pendiente              │
│ Caja activa                  │
├──────────────────────────────┤
│ + Agregar método de pago     │
├──────────────────────────────┤
│ Cancelar | Confirmar venta   │
└──────────────────────────────┘
```

No comprimir en dos columnas pequeñas.

No cortar labels.

## Tablet horizontal

Puede usar dos columnas.

Debe aprovechar el ancho.

Puede acercarse al desktop.

Pero:

- controles táctiles;
- mínimo 44px;
- márgenes más compactos;
- resumen lateral;
- evitar scroll innecesario.

---

# 16. MOBILE

Mobile debe ser:

# FULLSCREEN

No modal flotante.

Referencia:

```txt
< 768px
```

Usar:

```css
width: 100%;
height: 100dvh;
border-radius: 0;
```

Debe aprovechar casi todo el ancho.

No hacerlo exageradamente angosto.

Padding sugerido:

```txt
16px
```

Validar:

```txt
360px
375px
390px
412px
430px
```

---

# 17. FLUJO MOBILE

Orden:

```txt
Cobrar venta

Cliente
[CONSUMIDOR_FINAL]

Total a cobrar
$55.000

Método de pago
[Transferencia]
Cambiar

Banco o billetera
SOLO SI APLICA

[Bancolombia] [Nequi]
[Daviplata]   [Davivienda]

Monto
[$55.000]

Número de referencia *
[123456789]

Resumen
Total pagado
Cambio
Saldo pendiente
Caja activa

+ Agregar método de pago

Cancelar
Confirmar venta
```

Footer sticky si hace falta.

No tapar contenido.

No generar scroll horizontal.

---

# 18. BANCOS EN MOBILE

No intentar mostrar 6 tarjetas por fila.

Usar:

```txt
2 o 3 por fila
```

Dependiendo del ancho.

Cards pequeñas:

```txt
┌────────────┐
│   logo     │
│ Nequi      │
└────────────┘
```

No cortar nombres.

Si hay muchas entidades:

- mostrar primeras relevantes;
- usar "Ver todos";
- o permitir scroll interno controlado.

No hacer carrusel innecesario si grid funciona mejor.

---

# 19. PAGO MIXTO

Debe mantenerse.

Ejemplo:

```txt
Método #1
Efectivo
$30.000
Referencia: 123

Método #2
Transferencia
Bancolombia
$25.000
Referencia: ABC123
```

Total:

```txt
$55.000
```

Resultado:

```txt
Saldo pendiente: $0
Cambio: $0
```

Cada método conserva su propia:

- referencia;
- institución;
- monto.

---

# 20. COMPONENTES

No duplicar lógica.

Evitar:

```txt
DesktopPaymentModal
TabletPaymentModal
MobilePaymentModal
```

Preferir:

```txt
PaymentDialog
 ├── CustomerSection
 ├── PaymentTotal
 ├── PaymentMethodCard
 ├── PaymentMethodSelector
 ├── FinancialInstitutionSelector
 ├── PaymentFields
 ├── PaymentSummary
 ├── AddPaymentMethod
 └── PaymentActions
```

Responsive mediante layout.

---

# 21. CONFIGURACIÓN DINÁMICA

No hacer condiciones dispersas por toda la aplicación.

Centralizar reglas.

Ejemplo conceptual:

```ts
{
  code: 'TRANSFER',
  requiresReference: true,
  requiresFinancialInstitution: true,
  allowsPartialPayment: true
}
```

El frontend debe consumir configuración del backend.

---

# 22. CACHE / OFFLINE

Como es un POS, evaluar:

- cache de medios de pago;
- cache de instituciones;
- logos locales;
- comportamiento si backend está temporalmente caído.

No bloquear cobro por fallas visuales.

Si el POS ya tiene estrategia offline, integrarse a ella.

---

# 23. ESTADOS

Manejar:

```txt
loading
empty
error
disabled
selected
inactive
```

Ejemplo si no hay bancos configurados:

```txt
No hay bancos o billeteras configurados para este medio de pago.
```

No mostrar errores técnicos.

---

# 24. ACCESIBILIDAD

- labels correctos;
- foco visible;
- navegación por teclado;
- touch targets de mínimo 44px;
- aria-label si aplica;
- selected state claro;
- disabled state claro.

---

# 25. PRUEBAS RESPONSIVE

Validar mínimo:

## Desktop

```txt
1920x1080
1600x900
1366x768
1280x720
```

## Tablet vertical

```txt
768x1024
820x1180
```

## Tablet horizontal

```txt
1024x768
1180x820
```

## Mobile

```txt
360x800
375x812
390x844
412x915
430x932
```

---

# 26. PRUEBAS FUNCIONALES

Validar:

## Efectivo

- no bancos;
- referencia obligatoria;
- monto;
- confirmación.

## Débito

- no bancos;
- referencia obligatoria.

## Crédito

- no bancos;
- referencia obligatoria.

## Transferencia

- bancos visibles;
- selección obligatoria si así se configura;
- referencia obligatoria.

## QR

- solo instituciones compatibles.

## PSE

- solo instituciones compatibles.

## Pago mixto

- cálculo correcto;
- múltiples referencias;
- múltiples instituciones;
- saldo correcto.

---

# 27. CRUD — PRUEBAS

Validar:

```txt
crear medio
editar medio
desactivar medio
reordenar medio
crear banco
editar banco
cambiar logo
desactivar banco
vincular banco a transferencia
quitar banco de QR
```

El POS debe reflejar los cambios según la estrategia de cache definida.

---

# 28. MIGRACIONES

Crear migraciones seguras.

No borrar datos existentes.

Si actualmente hay métodos hardcodeados:

crear migración inicial que cargue:

```txt
Efectivo
Débito
Crédito
Transferencia
QR
PSE
```

Y las instituciones base.

Pero primero confirmar cómo está modelado actualmente.

No duplicar datos.

---

# 29. COMPATIBILIDAD

No romper:

- ventas existentes;
- reportes;
- cierres de caja;
- arqueos;
- consultas históricas;
- conciliaciones;
- exportaciones;
- facturación;
- medios de pago antiguos.

Si hoy se guarda texto del método, definir estrategia de compatibilidad.

---

# 30. ENTREGA FINAL

Antes de cerrar la tarea entregar:

```txt
1. Auditoría inicial
2. Modelo BD actual
3. Modelo BD propuesto
4. Migraciones
5. Endpoints
6. CRUD medios de pago
7. CRUD bancos/billeteras
8. Integración POS
9. Responsive desktop
10. Responsive tablet vertical
11. Responsive tablet horizontal
12. Responsive mobile fullscreen
13. Pago mixto
14. Validaciones
15. Pruebas
16. Build
17. Lint
18. Riesgos encontrados
19. Archivos modificados
20. Evidencia de funcionamiento
```

No considerar terminado únicamente porque se vea bonito.

Debe quedar:

```txt
configurable
responsive
funcional
sin lógica quemada
sin regresiones
```

---

# 31. REGLA FINAL DE UX

La jerarquía del usuario debe ser:

```txt
CLIENTE
↓
TOTAL
↓
MÉTODO DE PAGO
↓
BANCO / BILLETERA SOLO SI APLICA
↓
MONTO
↓
NÚMERO DE REFERENCIA *
↓
RESUMEN
↓
CONFIRMAR
```

No mostrar información que no aplique.

La pantalla debe sentirse rápida para un cajero.

No convertir el cobro en un formulario administrativo.
