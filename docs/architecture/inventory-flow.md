# Flujo de inventario

## Entradas y salidas de stock

El stock no se guarda como saldo directo por producto. Se calcula desde `stock_movements`.

## Fuentes de movimiento

- Compras recibidas: `IN`
- Ventas confirmadas: `OUT`
- Entregas de pedidos: `OUT`
- Ajustes manuales: `IN` o `OUT`

## Calculo

```sql
SUM(quantity WHERE type='IN') - SUM(quantity WHERE type='OUT')
```

## Contexto asociado al movimiento

- tenant
- producto
- branch
- terminal
- sesion POS
- usuario
- tabla/referencia origen

## Auditoria

Cada movimiento puede generar evento de auditoria con `stockBefore` y `stockAfter`.
