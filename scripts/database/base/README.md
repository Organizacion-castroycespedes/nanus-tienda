# Base SQL

Esta carpeta queda reservada para los archivos base del esquema.

Reglas:

- Los archivos base se usan para bootstrap de ambientes nuevos.
- No deben modificarse una vez un ambiente PRD ya fue desplegado.
- Cualquier cambio posterior debe vivir en `../migrations`.

Nota:

- El historico actual del proyecto sigue existiendo en `scripts/database/*.sql`.
- Esta carpeta define la estructura objetivo post-PRD sin reescribir la historia.
