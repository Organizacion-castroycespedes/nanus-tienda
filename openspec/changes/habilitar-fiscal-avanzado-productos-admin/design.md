## Context

Ver `proposal.md` para la motivacion. `ProductForm` ya concentra una capacidad booleana usada por el render del acordeon, las validaciones fiscales y la construccion del payload. La condicion actual admite `SUPER_ADMIN` y `SUPER_USER`, mientras la pagina y el backend ya admiten `ADMIN` con escritura de productos. Los servicios, endpoints y persistencia fiscal no requieren cambios.

La implementacion debe ser frontend-only, mantener el contrato actual y evitar tocar calculos fiscales. La gobernanza exige una asociacion exacta del diff con este OpenSpec.

## Goals / Non-Goals

**Goals:**

- Extender la capacidad fiscal central existente a `ADMIN` autorizado.
- Probar la matriz positiva `ADMIN`/`SUPER_USER`/`SUPER_ADMIN` y negativa `USER`.
- Probar que la misma capacidad controla render, validacion y payload de creacion/edicion.
- Preservar asignaciones y perfil fiscal al editar.

**Non-Goals:**

- Cambiar guards, permisos globales, seeds, endpoints, DTOs o persistencia backend.
- Cambiar preview, formulas o redondeos de IVA/ICL/ADV.
- Cambiar POS, FactuCore, facturacion electronica o base de datos.
- Verificar o desplegar produccion.

## Decisions

### Una capacidad central para todo el flujo fiscal

Se mantendra una sola decision de capacidad en el formulario y se incluira `ADMIN` junto con los roles ya admitidos. Render, validacion y payload continuaran consumiendo esa misma decision.

Alternativa descartada: agregar condiciones independientes al acordeon, a la validacion y al payload. Eso recrearia el drift que causo la regresion.

### La autorizacion gruesa sigue en la pagina y en el backend

El formulario no creara un nuevo modelo RBAC. La pagina solo abre creacion/edicion cuando `hasPermission("inventory.create"|"inventory.update")` lo permite, y el backend conserva `INVENTORY_PRODUCTS:WRITE` y el tenant del actor como autoridad final.

Alternativa descartada: modificar RBAC global o agregar un permiso fiscal nuevo. No existe evidencia de bloqueo backend y ampliaria innecesariamente el alcance.

### Pruebas focalizadas sobre comportamiento observable

Las pruebas cubriran la resolucion de capacidad por rol y el comportamiento de formulario para render, errores fiscales y payload. Los servicios se simularan; no se emitiran documentos ni se escribira en base de datos.

Alternativa descartada: validar solo la linea de roles. Eso no prueba que render, validacion y payload sigan unidos a la misma capacidad.

### Preservacion mediante contratos existentes

La edicion seguira hidratando `taxes` y `taxProfile` desde el detalle del producto y enviando la lista resultante por el servicio existente. No se introduciran transformaciones fiscales nuevas.

## Risks / Trade-offs

- [El formulario depende del estado Redux y varios catalogos asincronos] -> Usar mocks focalizados y datos deterministas para probar el flujo sin red.
- [Un test demasiado acoplado al texto visual puede ser fragil] -> Consultar roles, nombres accesibles y payloads contractuales relevantes.
- [Habilitar controles sin permiso de escritura seria escalamiento] -> Mantener la proteccion de la pagina y agregar caso negativo `USER`; el backend continua como autoridad final.
- [Enviar una lista incompleta puede borrar impuestos por reemplazo] -> Probar edicion con asignaciones existentes y confirmar que las no eliminadas permanecen en el payload.
- [El entorno puede carecer de dependencias o memoria para runners] -> Registrar `BLOCKED` con comando y error exactos; no instalar ni cambiar infraestructura.

## Migration Plan

1. Publicar el frontend solo despues de pruebas y revision del diff.
2. Ejecutar QA con un `ADMIN` del tenant Premium Brands sin emitir documentos fiscales reales.
3. Rollback: revertir la habilitacion frontend; no hay migracion de datos ni cambio backend que deshacer.
