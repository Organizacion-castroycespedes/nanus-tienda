## ADDED Requirements

### Requirement: Planes con precios versionados

El sistema SHALL administrar planes y versiones de precio inmutables con vigencia, moneda, un impuesto tomado de `public.taxes` del tenant plataforma, un indicador de precio con impuesto incluido, terminales POS incluidas, término inicial en meses, meses de prueba por defecto y componentes de precio por frecuencia.

#### Scenario: Publicar nueva versión de precio

- **WHEN** el SUPER_ADMIN publica una versión de precio con motivo
- **THEN** el sistema SHALL cerrar la vigencia de la versión anterior y no SHALL modificar los contratos existentes.

#### Scenario: Solapamiento de vigencias

- **WHEN** se publica una versión cuya vigencia se solapa con otra del mismo plan
- **THEN** el sistema SHALL rechazarla.

#### Scenario: Componentes de la propuesta comercial

- **WHEN** se configura una versión con `BASE_INITIAL_TERM` anual, `BASE_RENEWAL` mensual y anual, `EXTRA_POS_TERMINAL` mensual y anual, y `CERTIFICATION` anual
- **THEN** el sistema SHALL aceptarla y exponer cada monto como decimal exacto.

#### Scenario: Plan retirado

- **WHEN** un plan está `RETIRED`
- **THEN** el sistema SHALL impedir crear contratos nuevos con él y SHALL conservar los contratos existentes.

#### Scenario: Impuesto de otro tenant

- **WHEN** se publica una versión de precio con un `tax_id` que no pertenece al tenant plataforma o está inactivo
- **THEN** el sistema SHALL rechazarla con 422.

#### Scenario: IVA incluido por defecto

- **WHEN** se elige el impuesto IVA 19% configurado como incluido
- **THEN** la versión SHALL quedar con `prices_include_tax=true` y SHALL mostrar el desglose base e IVA de cada componente.
