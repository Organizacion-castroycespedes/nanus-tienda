# Prompt para Antigravity / Cursor / Codex
## Continuación de automatización fiscal del formulario de productos en Manus

## Contexto confirmado

Continúa exclusivamente sobre el trabajo ya iniciado.

```text
Worktree:
L:\Proyectos\sociedad\wt-product-tax-automation

Rama base:
origin/develop

Rama de trabajo:
feat/product-tax-automation

Commit actual:
7a41e4a feat(products): derive percentage tax prices from final price
```

Estado actual:

```text
FASE 1: COMPLETA
FASE 2: PARCIAL
FASE 3: PARCIAL
```

Arquitectura fiscal encontrada:

```text
taxes
product_taxes
tax_rates
perfiles fiscales
PricingService
```

Producto local de licor ya confirmado:

```text
perfil fiscal: DISTILLED_LIQUOR
grado alcohólico: 40
volumen: 700 ml
ICL DIAN: 32
ADV DIAN: 36
IVA: 5 %
```

Archivos ya modificados:

```text
api/src/modules/inventory/services/product.service.ts
api/src/modules/inventory/services/product-price-calculator.ts
api/src/modules/inventory/services/product-price-calculator.spec.ts
web/modules/inventory/components/ProductForm.tsx
docs/product-tax-automation-plan.md
```

No volver a empezar desde cero.

No crear otro worktree.

No cambiar de rama.

No hacer merge automático.

No inventar tarifas.

No inventar códigos DIAN.

No inventar perfiles fiscales.

---

# Regla de trabajo

Trabajar en este orden:

```text
1. REVISAR ESTADO ACTUAL
2. ACTUALIZAR PLAN
3. IMPLEMENTAR
4. PROBAR
5. DOCUMENTAR RESULTADOS
```

No mezclar etapas.

Antes de programar, leer:

```text
docs/product-tax-automation-plan.md
```

Ese archivo es la fuente de continuidad del trabajo.

Actualizarlo durante toda la ejecución.

---

# 1. Recuperar estado real

Dentro del worktree:

```bash
cd L:\Proyectos\sociedad\wt-product-tax-automation

git status
git branch --show-current
git log -5 --oneline
```

Confirmar:

```text
Rama:
feat/product-tax-automation
```

Revisar:

```bash
git show 7a41e4a
```

Revisar los archivos ya modificados.

No deshacer código que ya funciona.

No modificar otros worktrees.

---

# 2. Objetivo funcional

Quiero que registrar un producto sea fácil para el cliente.

El cliente NO debe configurar impuestos manualmente.

Para la mayoría de productos debe ingresar:

```text
Nombre *
Categoría *
Precio de venta final *
Costo
Unidad
```

Y únicamente si la categoría fiscal lo requiere:

```text
Presentación / volumen
Grado de alcohol
```

El sistema debe resolver automáticamente:

```text
perfil fiscal
impuestos aplicables
códigos DIAN
tarifas vigentes
bases gravables
orden fiscal
precio antes de impuestos
valor de cada impuesto
total de impuestos
precio final
```

El cliente no debe seleccionar manualmente:

```text
IVA 5 %
IVA 19 %
ICL 32
ADV 36
orden de impuesto
precio incluye impuesto
```

si esa información ya puede resolverse con el catálogo fiscal existente.

---

# 3. Flujo esperado: producto común

Ejemplo:

```text
Nombre:
Camiseta básica

Categoría:
Ropa

Precio de venta:
$119.000
```

Si el perfil fiscal real asociado determina IVA 19 %:

```text
Base:      $100.000
IVA:        $19.000
Total:     $119.000
```

El usuario no escribe:

```text
precio sin impuestos
IVA
base
```

---

# 4. Flujo esperado: aguardiente

El usuario debe poder registrar:

```text
Nombre:
Aguardiente Amarillo

Categoría:
Aguardiente / Licor destilado

Precio:
$...

Presentación:
1000 ml

Grado alcohol:
24 %
```

El sistema debe resolver:

```text
Categoría
    ↓
Perfil fiscal real
    ↓
DISTILLED_LIQUOR
    ↓
Catálogo fiscal vigente
    ↓
ICL 32
ADV 36
IVA correspondiente
    ↓
PricingService
    ↓
Precio neto
Impuestos
Precio final
```

No pedir al usuario que agregue manualmente ICL, ADV o IVA.

---

# 5. Flujo esperado: cerveza

Ejemplo:

```text
Nombre:
Cerveza Costeña

Categoría:
Cerveza

Precio:
$...

Presentación:
330 ml

Grado alcohol:
4 %
```

El sistema debe buscar el perfil fiscal REAL asociado a cerveza.

No copiar reglas de:

```text
DISTILLED_LIQUOR
```

No asumir que cerveza tributa igual que aguardiente.

Auditar el perfil, impuestos, tasas y reglas existentes para cerveza.

---

# 6. No implementar todavía múltiples presentaciones si no existen

No crear todavía una arquitectura grande como:

```text
Producto
├── 330 ml
├── 750 ml
└── 1000 ml
```

salvo que el proyecto ya tenga soporte equivalente.

En esta iteración:

```text
volumen
grado alcohol
```

pueden seguir perteneciendo al producto actual.

No crear migraciones grandes solo para anticipar presentaciones futuras.

Documentar la evolución futura si aplica.

---

# 7. Categoría → perfil fiscal

Este es el siguiente punto principal.

Auditar cómo se relacionan actualmente:

```text
categoría
categoría fiscal
perfil fiscal
producto
impuestos
```

Objetivo conceptual:

```text
Aguardiente
    ↓
DISTILLED_LIQUOR
```

No implementar lógica frágil como:

```typescript
if (categoryName === 'Aguardiente') {
  ...
}
```

si existe forma de resolverlo mediante:

```text
ID
FK
configuración
perfil fiscal
categoría fiscal
```

Usar relaciones reales.

Si no existe una relación suficiente:

1. detenerse;
2. documentar exactamente qué falta;
3. proponer la modificación mínima;
4. no inventar asociaciones.

---

# 8. Perfil fiscal → atributos requeridos

El backend debe definir qué información adicional necesita cada perfil.

Ejemplo conceptual:

```text
IVA_GENERAL
required:
[]

DISTILLED_LIQUOR
required:
- volume
- alcohol_degree

BEER
required:
- volume
- alcohol_degree
```

Usar nombres y estructuras reales del proyecto.

No crear estos perfiles si ya existen equivalentes.

El frontend debe recibir la configuración y dibujar los campos.

No dispersar reglas fiscales en React.

---

# 9. Preview fiscal en backend

Crear o reutilizar el mecanismo adecuado para obtener una previsualización fiscal antes de guardar.

Debe respetar la arquitectura existente.

No inventar una ruta sin revisar primero los controladores y servicios actuales.

Entrada conceptual:

```text
categoryId
salePrice
volume
alcoholDegree
date
```

según aplique.

Resolución:

```text
categoría
→ perfil fiscal
→ impuestos
→ tax_rates vigentes
→ PricingService
→ resultado
```

Salida conceptual:

```json
{
  "salePrice": 63000,
  "netPrice": 33480,
  "totalTax": 29520,
  "fiscalProfile": "DISTILLED_LIQUOR",
  "taxes": [
    {
      "code": "32",
      "amount": 12096
    },
    {
      "code": "36",
      "amount": 15750
    },
    {
      "code": "01",
      "amount": 1674
    }
  ]
}
```

Adaptar nombres y DTOs al proyecto real.

No copiar literalmente esta estructura si contradice el dominio actual.

---

# 10. Backend como autoridad

Frontend puede enviar:

```text
precio final
categoría
grado
volumen
```

Pero no debe ser autoridad sobre:

```text
netPrice
taxAmount
taxBase
taxRate
taxCode
```

CREATE y UPDATE deben recalcular en backend.

No confiar en valores derivados enviados por React.

---

# 11. Reutilizar PricingService

Ya existe un motor fiscal POS:

```text
PricingService
```

No duplicar fórmulas especiales de:

```text
ICL
ADV
IVA de licores
```

dentro de:

```text
ProductForm.tsx
product.service.ts
product-price-calculator.ts
```

si PricingService ya puede resolverlas.

Objetivo:

```text
creación/edición producto
        ↓
resolución perfil fiscal
        ↓
PricingService
```

`product-price-calculator` puede seguir resolviendo casos simples de porcentajes si corresponde, pero no debe convertirse en un segundo motor fiscal paralelo.

Si existe solapamiento, documentarlo y reducirlo con el menor riesgo posible.

---

# 12. UX del formulario

El formulario normal debe verse simple.

## Información básica

```text
Nombre *
Categoría *
Precio de venta *
Costo
Unidad
```

## Información adicional dinámica

Solo si el perfil la requiere:

```text
Presentación *
[1000] [ml]

Grado de alcohol *
[24] %
```

## Información fiscal

En modo lectura:

```text
Configuración fiscal detectada automáticamente

Base antes de impuestos    $...
Impuestos                  $...
Precio de venta            $...
```

Agregar opcionalmente:

```text
Ver detalle fiscal
```

Detalle solo lectura:

```text
IVA
ICL
ADV
bases
tarifas
códigos
```

---

# 13. Ocultar configuración manual del flujo normal

Si categoría/perfil ya resuelve impuestos, ocultar del flujo principal:

```text
Agregar impuesto
Orden
Precio incluye impuesto
Seleccionar ICL
Seleccionar ADV
Seleccionar IVA
```

No borrar todavía tablas ni lógica existente.

Si hay necesidad operativa, conservarlo bajo:

```text
Configuración fiscal avanzada
```

para usuarios autorizados.

---

# 14. Presentación / volumen

Mejorar el campo actual.

En lugar de:

```text
Volumen neto (ml)
```

mostrar:

```text
Presentación
[ 1000 ] [ ml ▼ ]
```

Soportar al menos:

```text
ml
L
```

si el proyecto no tiene más unidades.

Normalizar internamente.

Ejemplos:

```text
1 L     → 1000 ml
1.05 L  → 1050 ml
330 ml  → 330 ml
```

El motor fiscal debe trabajar con una unidad normalizada.

Agregar tests.

---

# 15. No deducir silenciosamente desde el nombre

Si el usuario escribe:

```text
Aguardiente Amarillo 1000ml
```

se puede detectar:

```text
1000 ml
```

como ayuda de UX.

Pero debe aparecer visible como valor prellenado.

No guardar silenciosamente información fiscal extraída del nombre.

Esta mejora es secundaria.

No bloquear la implementación principal por esto.

---

# 16. Resolver ambigüedad de tarifas VAT

Ya existe un riesgo confirmado:

```text
Catálogo local tiene tarifas VAT ambiguas.
```

No elegir una tarifa arbitrariamente.

Investigar:

```text
perfil fiscal
vigencia
estado
prioridad
tenant/empresa
tipo de producto
relación con product_taxes
relación con tax_rates
```

Determinar cómo debe seleccionarse una tarifa de forma inequívoca.

Si el modelo actual no permite resolverla:

```text
BLOQUEAR SOLO ESE CASO
```

y documentar la relación faltante.

No hacer:

```typescript
rates.find(r => r.rate === 19)
```

solo para pasar tests.

---

# 17. CREATE real obligatorio

Esta iteración debe probar creación real.

Usar autenticación y mecanismos existentes.

No inventar tokens.

## Caso IVA común

Caso controlado:

```text
Precio final:
119000

IVA:
19 %
```

Esperado:

```text
Base:
100000

IVA:
19000

Total:
119000
```

Después de crear:

1. consultar nuevamente;
2. revisar valores persistidos;
3. comprobar impuestos;
4. comprobar perfil fiscal;
5. comprobar neto.

---

# 18. CREATE real de licor

Usar datos REALES ya existentes en desarrollo.

Se confirmó un producto/perfil:

```text
DISTILLED_LIQUOR
40 grados
700 ml
ICL 32
ADV 36
IVA 5 %
```

No crear tarifas nuevas.

No alterar tasas para hacer pasar el test.

Validar:

```text
perfil resuelto
ICL presente
ADV presente
IVA presente
precio neto
total impuestos
precio final
```

Comprobación obligatoria:

```text
neto + suma(impuestos) = precio final
```

con la política de redondeo existente.

---

# 19. UPDATE real

Probar actualización real.

Para producto común:

```text
cambiar precio
```

y verificar recalculo.

Para licor probar, si el modelo permite:

```text
cambiar precio
cambiar volumen
cambiar grado alcohol
```

y comprobar recalculo fiscal.

No alterar historial de ventas existentes.

---

# 20. Tests unitarios

Mantener todos los tests actuales pasando.

Actualmente:

```text
65/65
```

No reducir cobertura existente.

Agregar pruebas para:

```text
categoría → perfil
perfil → impuestos
atributos requeridos
normalización ml/L
IVA incluido
licor
cambio precio
cambio volumen
cambio grado
tarifa ambigua
tarifa sin vigencia
```

---

# 21. POS

Después de CREATE/UPDATE, validar el flujo real de POS.

Seguir:

```text
producto
→ carrito
→ PricingService
→ subtotal
→ impuestos
→ total
```

Comprobar que la nueva automatización no cambia accidentalmente la semántica del precio.

Validar al menos:

```text
producto normal
producto licor
```

No es obligatorio crear E2E de navegador si el proyecto no tiene infraestructura para ello.

Sí debe probarse el servicio o integración real disponible.

---

# 22. Facturación y XML

La validación ya no puede quedar pendiente por completo.

Seguir un caso real:

```text
producto
→ venta
→ factura
→ impuestos
→ XML
```

Para licor confirmar que continúan llegando:

```text
32 → ICL
36 → ADV
01 → IVA
```

según la configuración real.

No rediseñar FactuCore.

No tocar PDF/XML salvo que se encuentre una regresión directamente causada por este cambio.

---

# 23. No hacer refactors fuera del alcance

No:

```text
rediseñar PDF
reescribir facturación
cambiar arquitectura completa
crear nuevas capas sin necesidad
migrar productos a presentaciones múltiples
hacer limpieza general del proyecto
```

Resolver primero el flujo de creación/edición automática.

---

# 24. Actualizar el plan continuamente

Actualizar:

```text
docs/product-tax-automation-plan.md
```

Checklist mínimo:

```text
[x] cálculo porcentual desde precio final
[ ] categoría → perfil fiscal
[ ] perfil → impuestos
[ ] atributos dinámicos
[ ] preview backend
[ ] formulario simplificado
[ ] normalización volumen
[ ] create real IVA
[ ] update real IVA
[ ] create real licor
[ ] update real licor
[ ] POS
[ ] facturación
[ ] XML
[ ] build
[ ] lint
```

No marcar un punto como completo sin evidencia.

---

# 25. Commits

No hacer un único commit gigante.

Crear commits pequeños y coherentes.

Ejemplos:

```text
feat(products): resolve fiscal profile from category
feat(products): add backend fiscal preview
feat(products): simplify automatic tax form
test(products): cover automatic fiscal product flow
```

Ajustar mensajes al cambio real.

---

# 26. Validación técnica final

Ejecutar:

```bash
git status
git diff --stat
git diff
```

Luego las pruebas del proyecto.

Como mínimo:

```bash
npm test
npm run build
npm run lint
```

o comandos equivalentes para cada módulo.

Validar:

```text
API build
web build/lint
tests
```

No ocultar fallos.

---

# 27. Criterios para estado LISTO

Solo declarar:

```text
ESTADO FINAL: LISTO
```

si se comprueba:

```text
✓ categoría resuelve perfil
✓ perfil resuelve impuestos
✓ tarifas salen del catálogo real
✓ precio neto automático
✓ formulario simple
✓ licor automático
✓ create real
✓ update real
✓ tests
✓ build API
✓ build/lint web
✓ POS sin regresión
✓ facturación sin regresión
✓ XML mantiene códigos tributarios correctos
```

Si alguno no puede comprobarse:

```text
ESTADO FINAL: PARCIAL
```

Indicar exactamente por qué.

---

# 28. Resultado funcional final esperado

Debe ser posible registrar:

```text
Aguardiente Amarillo

Categoría:
Aguardiente

Precio:
$...

Presentación:
1000 ml

Grado:
24 %
```

Y Manus debe ejecutar detrás:

```text
categoría
↓
perfil fiscal
↓
DISTILLED_LIQUOR
↓
ICL + ADV + IVA
↓
tax_rates vigentes
↓
PricingService
↓
precio neto
impuestos
precio final
```

Para:

```text
Cerveza Costeña

Categoría:
Cerveza

Precio:
$...

Presentación:
330 ml

Grado:
4 %
```

debe utilizar el perfil fiscal REAL de cerveza encontrado en el proyecto.

No copiar reglas del aguardiente.

---

# 29. Entrega final obligatoria

Al terminar responder con:

```text
1. Worktree utilizado
2. Rama base
3. Rama de trabajo
4. Commit inicial
5. Diagnóstico de continuidad
6. Plan ejecutado
7. Relación categoría → perfil encontrada
8. Perfiles fiscales utilizados
9. Cambios frontend
10. Cambios backend
11. Cambios BD si existieron
12. Preview fiscal implementado
13. Prueba create IVA
14. Prueba update IVA
15. Prueba create licor
16. Prueba update licor
17. Pruebas POS
18. Pruebas facturación
19. Pruebas XML
20. Tests unitarios
21. Build/lint
22. Commits creados
23. Riesgos pendientes
24. Estado final: LISTO / PARCIAL / BLOQUEADO
```

---

# Regla final

El cliente describe qué vende.

Manus determina cómo tributa.

No convertir el formulario de productos en un formulario contable.

No inventar información fiscal.

No duplicar el motor fiscal.

No salir del worktree aislado.

No hacer merge automático.

Primero continuar el plan existente, luego implementar, luego probar.
