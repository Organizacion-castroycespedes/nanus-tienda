# Normalización de ubicación fiscal en clientes y proveedores

Los formularios muestran códigos técnicos y selectores de ubicación al mismo tiempo. Esto permite combinaciones inconsistentes. La ubicación fiscal debe seleccionarse por país, departamento y municipio legibles, mientras el sistema conserva sus códigos canónicos.

El alcance cubre `/customers`, `/inventory/suppliers`, sus contratos de persistencia y la validación jerárquica del backend. No cambia el modelo fiscal ni elimina los códigos del dominio.
