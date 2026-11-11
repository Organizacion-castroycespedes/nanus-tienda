# Runbook: roles de base de datos del MANUS Control Center

OpenSpec: `habilitar-plataforma-control-center` · Migración: `V111__control_center_foundation.sql`

Este runbook lo ejecuta el DBA **antes** de aplicar V111 en cada ambiente. Los roles son objetos del clúster y llevan credenciales, por eso no los crea el runner de migraciones. No guardes contraseñas en el repositorio.

## Modelo

| Rol | Tipo | Uso |
|---|---|---|
| `manus_control_center_app` | `NOLOGIN` | Rol de grupo. Recibe todos los privilegios del Control Center (V111). |
| `manus_cc_local` / `manus_cc_qa` / `manus_cc_prd` | `LOGIN` | Usuario de conexión de la API para el Control Center en cada ambiente. Miembro del grupo. |

Reglas:

- El usuario runtime de la API operativa (`manus_user`, `manus_qa_user`, etc.) **no** debe ser miembro de `manus_control_center_app` ni dueño del esquema `control_center`.
- El usuario que aplica migraciones es el dueño de los objetos de `control_center`. Si en un ambiente ese usuario es el mismo que el runtime de la API, el aislamiento se rompe: el endpoint de readiness lo reporta como `operationalRoleHasSchemaAccess=true` y el estado queda `DEGRADED`.

## 1. Crear el rol de grupo (una vez por clúster)

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'manus_control_center_app') THEN
    CREATE ROLE manus_control_center_app NOLOGIN;
  END IF;
END $$;
```

## 2. Crear el usuario de conexión del ambiente

Reemplaza `<ambiente>` (`local`, `qa`, `prd`) y genera una contraseña fuerte fuera del repositorio (gestor de secretos).

```sql
CREATE ROLE manus_cc_<ambiente> LOGIN PASSWORD '<contraseña-generada>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;
GRANT manus_control_center_app TO manus_cc_<ambiente>;
ALTER ROLE manus_cc_<ambiente> SET search_path = control_center, public;
GRANT CONNECT ON DATABASE <base_del_ambiente> TO manus_cc_<ambiente>;
```

El usuario hereda los privilegios del grupo (`INHERIT`); la API no ejecuta `SET ROLE`.

## 3. Verificar antes de migrar

```sql
SELECT rolname, rolcanlogin FROM pg_roles
WHERE rolname IN ('manus_control_center_app', 'manus_cc_<ambiente>');

-- El runtime operativo no debe pertenecer al grupo:
SELECT pg_has_role('<usuario_runtime_api>', 'manus_control_center_app', 'MEMBER');  -- esperado: false
```

## 4. Aplicar V111

Con el runner oficial y primero en modo dry-run:

```bash
MIGRATION_DRY_RUN=YES bash scripts/database/apply_single_migration.sh scripts/database/migrations/V111__control_center_foundation.sql
```

Si el rol de grupo no existe, la migración falla con `CONTROL_CENTER_ROLE_MISSING` sin dejar cambios.

## 5. Configurar la API

Variables por ambiente (en secretos, no en el repo):

```
CONTROL_CENTER_ENABLED=true
CONTROL_CENTER_DB_USERNAME=manus_cc_<ambiente>
CONTROL_CENTER_DB_PASSWORD=<contraseña-generada>
PLATFORM_TENANT_ID=00000000-0000-0000-0000-000000000001
```

Host, puerto, base y SSL se reutilizan de `DB_*`. Con `CONTROL_CENTER_ENABLED` distinto de `true` o sin credenciales, el módulo responde `503 CONTROL_CENTER_DISABLED` y no abre conexiones.

## 6. Verificación posterior

`GET /api/admin/control-center/readiness` con un SUPER_ADMIN del tenant plataforma debe responder `status: "READY"`.

## Rotación de credenciales

```sql
ALTER ROLE manus_cc_<ambiente> PASSWORD '<nueva-contraseña>';
```

Actualiza el secreto `CONTROL_CENTER_DB_PASSWORD` y reinicia la API.

## Rollback

`scripts/database/rollbacks/V111__control_center_foundation_rollback.sql` elimina el esquema solo si no tiene tablas de negocio ni eventos de auditoría. Los roles se eliminan manualmente:

```sql
DROP ROLE IF EXISTS manus_cc_<ambiente>;
DROP ROLE IF EXISTS manus_control_center_app;  -- solo si ningún ambiente del clúster lo usa
```

## Avisos de cobro para la API operativa (V114)

V114 crea `public.tenant_billing_notices`. La escribe solo `manus_control_center_app`. La API operativa la lee para mostrar el banner de pagos en el dashboard del tenant cliente.

La migración concede `SELECT` a `manus_user` y `manus_qa_user` cuando existen. Si el usuario runtime de la API operativa tiene otro nombre, concede solo lectura:

```sql
GRANT SELECT ON public.tenant_billing_notices TO <usuario_runtime_api>;
```

No le concedas `INSERT`, `UPDATE` ni `DELETE`, ni acceso al esquema `control_center`. Si no hay permiso de lectura, el endpoint `GET /billing-notices/active` responde una lista vacía y el dashboard sigue funcionando sin banner.

## Correo de alertas (fase 3)

Variables de la API:

- `CONTROL_CENTER_ALERTS_ENABLED`
- `CONTROL_CENTER_ALERTS_EMAIL_ENABLED`
- `CONTROL_CENTER_SMTP_HOST`, `CONTROL_CENTER_SMTP_PORT`, `CONTROL_CENTER_SMTP_SECURE`, `CONTROL_CENTER_SMTP_USER`, `CONTROL_CENTER_SMTP_PASSWORD`
- `CONTROL_CENTER_ALERTS_FROM`
- `CONTROL_CENTER_PAYMENT_INSTRUCTIONS`

Las alertas automáticas corren después del worker de facturación, así que también requieren `CONTROL_CENTER_BILLING_WORKER_ENABLED=true`. Antes de activarlas, envía un correo de prueba desde **Cartera → Correo de prueba**.

## WhatsApp Cloud API

El canal se despliega apagado. Pasos para activarlo:

1. **Cuenta de Meta.** En [business.facebook.com](https://business.facebook.com) crea o verifica el portafolio de negocio. En [developers.facebook.com](https://developers.facebook.com) crea una app de tipo *Business* y agrégale el producto **WhatsApp**.
2. **Número.** En **WhatsApp → Configuración de la API**, registra un número que no esté en uso en la app de WhatsApp. Copia el **Identificador del número de teléfono** en `CONTROL_CENTER_WHATSAPP_PHONE_NUMBER_ID`.
3. **Token.** En el portafolio, ve a **Usuarios del sistema**. Crea un usuario de sistema con acceso a la app y a la cuenta de WhatsApp, y genera un token permanente con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`. Guárdalo como secreto en `CONTROL_CENTER_WHATSAPP_ACCESS_TOKEN`; nunca lo subas al repositorio.
4. **Plantillas.** En WhatsApp Manager → **Plantillas de mensajes**, crea estas tres en categoría **Utility** e idioma **Español** (`es`):
   - `manus_cobro_previo`: "Hola {{1}}, te recordamos que el cargo {{2}} de MANUS POS por {{3}} vence el {{4}}. Si ya pagaste, ignora este mensaje."
   - `manus_cobro_vence_hoy`: "Hola {{1}}, el cargo {{2}} de MANUS POS por {{3}} vence hoy, {{4}}. Si ya pagaste, ignora este mensaje."
   - `manus_cobro_vencido`: "Hola {{1}}, el cargo {{2}} de MANUS POS por {{3}} venció el {{4}} y lleva {{5}} días de mora. Comunícate con nosotros para ponerte al día."

   Si cambias los nombres, ajusta `CONTROL_CENTER_WHATSAPP_TEMPLATE_UPCOMING`, `_DUE` y `_OVERDUE`. El orden de los parámetros debe ser el indicado.
5. **Prueba.** Reinicia la API y, en **Cartera → WhatsApp de prueba**, envía la plantilla de muestra `hello_world` a tu celular en formato E.164 (+57…). Con un número de prueba de Meta, el destino debe estar en la lista de destinatarios permitidos.
6. **Activación.** Con las plantillas aprobadas, define `CONTROL_CENTER_WHATSAPP_ENABLED=true` y reinicia la API.

Solo se envía a cuentas comerciales con teléfono E.164 y consentimiento de WhatsApp registrado (**Cuentas → editar**). Meta cobra cada plantilla entregada según su tarifa por mensaje.

## PDF del contrato

- **Datos del emisor.** El encabezado y la sección de partes usan la empresa del tenant plataforma: **Configuración → Empresa** (razón social, NIT, DV, dirección, ciudad, teléfono, correo y sitio web) y **Marca** (logo). El logo debe ser una imagen PNG o JPEG cargada; las URL externas se ignoran.
- **Cláusulas.** Para reemplazar las cláusulas base, crea un archivo de texto con títulos `## Título` y párrafos separados por una línea en blanco, y define `CONTROL_CENTER_CONTRACT_TERMS_FILE` con su ruta. Usa `{{instrucciones_pago}}` donde quieras insertar `CONTROL_CENTER_PAYMENT_INSTRUCTIONS`.
- **Revisión legal.** Las cláusulas base son una plantilla general. Conviene revisarlas con asesoría legal antes de entregarlas a clientes.
