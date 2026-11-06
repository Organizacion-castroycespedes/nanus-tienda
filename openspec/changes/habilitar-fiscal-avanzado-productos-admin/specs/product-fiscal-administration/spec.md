## Purpose

Definir el acceso y la preservacion de la configuracion fiscal avanzada de productos para roles operativos autorizados, manteniendo aislamiento por tenant y compatibilidad con los calculos fiscales existentes.

## ADDED Requirements

### Requirement: Acceso fiscal avanzado por rol y permiso

El sistema SHALL permitir administrar la configuracion fiscal avanzada de productos a `ADMIN`, `SUPER_USER` y `SUPER_ADMIN` cuando el actor tenga capacidad efectiva de escritura de productos, y SHALL NOT exponerla a `USER` ni a actores sin esa capacidad.

#### Scenario: ADMIN autorizado abre el formulario

- **WHEN** un `ADMIN` con escritura de productos abre el formulario de creacion o edicion
- **THEN** el sistema SHALL mostrar la configuracion fiscal avanzada con el mismo comportamiento funcional disponible para `SUPER_USER` y `SUPER_ADMIN`

#### Scenario: Rol superior autorizado abre el formulario

- **WHEN** un `SUPER_USER` o `SUPER_ADMIN` autorizado abre el formulario de creacion o edicion
- **THEN** el sistema SHALL conservar la configuracion fiscal avanzada existente sin regresiones

#### Scenario: USER abre productos

- **WHEN** un `USER` o un actor sin escritura de productos intenta acceder a la configuracion fiscal avanzada
- **THEN** el sistema SHALL NOT mostrar ni habilitar controles fiscales avanzados

### Requirement: Creacion fiscal completa de producto

El sistema SHALL validar y enviar categoria fiscal, precio DANE, vigencias y asignaciones de impuestos cuando un actor autorizado crea un producto con configuracion fiscal avanzada.

#### Scenario: ADMIN crea producto con IVA incluido

- **WHEN** un `ADMIN` autorizado crea un producto con IVA 19% incluido y una categoria fiscal valida
- **THEN** el sistema SHALL validar la configuracion y SHALL enviar `taxId`, `taxes` y `taxProfile` mediante el contrato existente

#### Scenario: ADMIN crea producto con ADV

- **WHEN** un `ADMIN` autorizado asigna ADV al crear un producto sin precio DANE requerido
- **THEN** el sistema SHALL impedir el envio y SHALL mostrar la validacion fiscal existente

#### Scenario: Creacion con vigencias fiscales

- **WHEN** un actor autorizado informa vigencia inicial o final para el precio DANE
- **THEN** el sistema SHALL incluir las vigencias en el perfil fiscal sin alterar su formato contractual

### Requirement: Edicion y preservacion fiscal

El sistema SHALL permitir que un actor autorizado edite asignaciones y perfil fiscal sin borrar configuracion existente que no haya sido eliminada explicitamente.

#### Scenario: ADMIN edita asignaciones existentes

- **WHEN** un `ADMIN` autorizado carga un producto con impuestos existentes, cambia una asignacion y guarda
- **THEN** el sistema SHALL enviar la lista fiscal resultante y SHALL preservar las asignaciones que permanecen seleccionadas

#### Scenario: ADMIN edita datos no fiscales

- **WHEN** un `ADMIN` autorizado edita un producto fiscal y no elimina ni cambia su configuracion fiscal
- **THEN** el sistema SHALL conservar categoria, precio DANE, vigencias y asignaciones existentes

#### Scenario: Eliminacion fiscal explicita

- **WHEN** un actor autorizado elimina explicitamente una asignacion fiscal y guarda
- **THEN** el sistema SHALL enviar la configuracion resultante usando el comportamiento existente de reemplazo de impuestos

### Requirement: Aislamiento y compatibilidad fiscal

La habilitacion frontend SHALL reutilizar las autorizaciones y contratos existentes, SHALL mantener el tenant autenticado como limite de datos y SHALL NOT modificar calculos de IVA, ICL o ADV.

#### Scenario: Catalogos de otro tenant

- **WHEN** un actor autorizado administra un producto de su contexto
- **THEN** el sistema SHALL usar unicamente catalogos y asignaciones admitidos por el backend para el tenant autenticado

#### Scenario: Intento cross-tenant

- **WHEN** un actor intenta guardar una asignacion fiscal que no pertenece al tenant autenticado
- **THEN** el backend existente SHALL rechazarla y la habilitacion frontend SHALL NOT introducir ningun bypass

#### Scenario: Calculo fiscal existente

- **WHEN** se guarda un producto con IVA, ICL o ADV desde el formulario habilitado
- **THEN** el sistema SHALL conservar los calculos, preview, POS y facturacion electronica existentes sin cambiar formulas ni redondeos
