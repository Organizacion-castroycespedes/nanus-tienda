# Despliegue actual

## Frontend Vercel

Estado real encontrado:

- `web/vercel.json` con `framework: nextjs`
- no hay configuraciones extra de rewrites en el repo

## Backend Linux/PM2

Estado real encontrado:

- `api/ecosystem.config.js`
- script objetivo `./dist-bin/api`
- modo `cluster`
- reinicio automatico

## AWS

No hay Terraform, CloudFormation ni CDK en el repositorio. El backend es compatible con despliegue en AWS EC2 o instancia Linux similar porque:

- genera binario propio
- usa PM2
- depende de variables de entorno y PostgreSQL externo

## PostgreSQL

- conexion por variables `DB_*`
- sin ORM ni migrador automatizado
- scripts SQL manuales en `api/database/`

## CORS y dominios

- `CORS_ORIGIN` controla origenes permitidos
- la validacion soporta dominio exacto y subdominios

## Nginx reverse proxy

No existe config Nginx en el repo. Se recomienda solo como capa de despliegue externa; no es parte versionada hoy.

## CI/CD y GitHub

No se detectaron workflows de GitHub Actions ni pipelines CI/CD en el repositorio actual.

## Docker

No se detectaron Dockerfile ni compose files.
