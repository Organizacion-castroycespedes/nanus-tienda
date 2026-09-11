# Diseño

Los formularios mantienen `countryCode`, `departmentCode` y `municipalityCode` como estado interno. Los controles editables son únicamente `País`, `Departamento` y `Municipio`, respaldados por los catálogos existentes.

La selección de país limpia departamento y municipio; la selección de departamento limpia municipio. Al hidratar una edición, los códigos canónicos seleccionan automáticamente las entidades del catálogo.

El backend valida que la combinación de códigos exista en la jerarquía activa `paises -> departamentos -> municipios`. Para Colombia exige los tres códigos. La validación ocurre antes de persistir y antes de cualquier uso fiscal.

Los campos técnicos fiscales permanecen internos o de solo lectura según su naturaleza. `Consultar DIAN mock` continúa siendo una herramienta de desarrollo y no se convierte en una operación DIAN productiva.
