-- ================================
-- 1) CREAR USUARIO (OWNER)
-- ================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'postgresql'
  ) THEN
    CREATE ROLE postgresql WITH
      LOGIN
      PASSWORD 'root'
      CREATEDB;
  END IF;
END$$;

-- ================================
-- 2) CREAR BASE DE DATOS
-- ================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_database WHERE datname = 'tenantcore-platform'
  ) THEN
    CREATE DATABASE tenantcore-platform
      OWNER postgresql
      ENCODING 'UTF8'
      LC_COLLATE 'C'
      LC_CTYPE 'C'
      TEMPLATE template0;
  END IF;
END$$;

-- ================================
-- 3) PERMISOS (opcional pero recomendado)
-- ================================
GRANT ALL PRIVILEGES ON DATABASE tenantcore-platform TO postgresql;


CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT,
  config JSONB,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenants_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  razon_social TEXT NOT NULL,
  nit TEXT NOT NULL,
  dv TEXT,
  tipo_persona TEXT NOT NULL,
  tipo_sociedad TEXT,
  fecha_constitucion DATE,
  estado TEXT NOT NULL DEFAULT 'Activa',
  responsabilidades_dian TEXT,
  regimen TEXT,
  actividad_economica TEXT,
  obligado_facturacion_electronica BOOLEAN NOT NULL DEFAULT FALSE,
  resolucion_dian TEXT,
  fecha_inicio_facturacion DATE,
  direccion_principal TEXT,
  ciudad TEXT,
  departamento TEXT,
  pais TEXT NOT NULL DEFAULT 'Colombia',
  telefono TEXT,
  email_corporativo TEXT,
  sitio_web TEXT,
  representante_nombre TEXT,
  representante_tipo_documento TEXT,
  representante_numero_documento TEXT,
  representante_email TEXT,
  representante_telefono TEXT,
  cuenta_contable_defecto TEXT,
  banco_principal TEXT,
  numero_cuenta TEXT,
  tipo_cuenta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  es_principal BOOLEAN NOT NULL DEFAULT FALSE,
  direccion TEXT,
  ciudad TEXT,
  departamento TEXT,
  pais TEXT,
  telefono TEXT,
  email TEXT,
  estado TEXT NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_branches_estado_check CHECK (estado IN ('ACTIVE', 'INACTIVE')),
  UNIQUE (tenant_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_tenant_branches_tenant ON tenant_branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_branches_estado ON tenant_branches(estado);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_branches_principal
  ON tenant_branches(tenant_id)
  WHERE es_principal = TRUE;

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  documento_tipo TEXT NOT NULL,
  documento_numero TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT,
  email_personal TEXT,
  cargo_nombre TEXT NOT NULL,
  cargo_descripcion TEXT,
  funciones_descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  persona_id UUID UNIQUE REFERENCES personas(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS persona_tenant_branches (
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  tenant_branch_id UUID NOT NULL REFERENCES tenant_branches(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  es_principal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (persona_id, tenant_branch_id)
);

CREATE INDEX IF NOT EXISTS idx_personas_tenant_documento
  ON personas(tenant_id, documento_numero);

CREATE INDEX IF NOT EXISTS idx_personas_tenant_email
  ON personas(tenant_id, email_personal);

CREATE INDEX IF NOT EXISTS idx_persona_branches_tenant
  ON persona_tenant_branches(tenant_id);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  route TEXT NOT NULL,
  label TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (token_hash)
);

INSERT INTO tenants (id, slug, nombre, config, activo)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default',
  'Tenant Principal',
  '{}'::jsonb,
  TRUE
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO roles (id, nombre, descripcion)
SELECT
  '00000000-0000-0000-0000-000000000010',
  'SUPER_ADMIN',
  'Super administrador del sistema'
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE nombre = 'SUPER_ADMIN'
);


INSERT INTO users (id, tenant_id, email, password_hash, estado)
SELECT
  '00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000001',
  'icastror@hotmail.com',
  crypt('Admin123!', gen_salt('bf')),
  'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1
  FROM users
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND email = 'icastror'
);

INSERT INTO user_roles (user_id, role_id, tenant_id)
SELECT
  '00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (
  SELECT 1
  FROM user_roles
  WHERE user_id = '00000000-0000-0000-0000-000000000100'
    AND role_id = '00000000-0000-0000-0000-000000000010'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
);

INSERT INTO permissions (role_id, tenant_id, module, route, label, visible)
SELECT
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'usuarios',
  '/{tenant}/usuarios',
  'Usuarios',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM permissions
  WHERE role_id = '00000000-0000-0000-0000-000000000010'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
    AND module = 'usuarios'
    AND route = '/{tenant}/usuarios'
);

INSERT INTO permissions (role_id, tenant_id, module, route, label, visible)
SELECT
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'configuracion',
  '/{tenant}/configuracion',
  'Configuracion',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM permissions
  WHERE role_id = '00000000-0000-0000-0000-000000000010'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
    AND module = 'configuracion'
    AND route = '/{tenant}/configuracion'
);

-- Permiso: Gestión de Roles (SUPER_ADMIN)
INSERT INTO public.permissions (
  id,
  role_id,
  tenant_id,
  module,
  route,
  label,
  visible,
  created_at
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'roles',
  '/{tenant}/roles',
  'Roles',
  TRUE,
  now()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.permissions
  WHERE role_id = '00000000-0000-0000-0000-000000000010'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
    AND module = 'roles'
);


INSERT INTO tenants_detalles (
  tenant_id,
  razon_social,
  nit,
  dv,
  tipo_persona,
  tipo_sociedad,
  fecha_constitucion,
  estado,
  responsabilidades_dian,
  regimen,
  actividad_economica,
  obligado_facturacion_electronica,
  resolucion_dian,
  fecha_inicio_facturacion,
  direccion_principal,
  ciudad,
  departamento,
  pais,
  telefono,
  email_corporativo,
  sitio_web,
  representante_nombre,
  representante_tipo_documento,
  representante_numero_documento,
  representante_email,
  representante_telefono,
  cuenta_contable_defecto,
  banco_principal,
  numero_cuenta,
  tipo_cuenta
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Tenantcore Platform S.A.S',
  '901234567',
  '1',
  'JURIDICA',
  'SAS',
  '2024-01-15',
  'Activa',
  'Responsable de IVA; Agente retenedor',
  'Régimen ordinario',
  'Comercio al por mayor y al por menor de vidrios, aluminio, hierro y accesorios',
  TRUE,
  'Resolución DIAN No. 18764012345678',
  '2024-02-01',
  'Cra 45 # 72 - 10, Local 3',
  'Barranquilla',
  'Atlántico',
  'Colombia',
  '+57 300 123 4567',
  'info@softmetalglass.com',
  'https://softmetalglass.com',
  'Ivan Castro Ruiz',
  'CC',
  '1043436352',
  'representante@softmetalglass.com',
  '+57 301 555 8899',
  '110505', -- ejemplo de cuenta contable
  'Bancolombia',
  '12345678901',
  'AHORROS'
)
ON CONFLICT (tenant_id) DO NOTHING;


INSERT INTO tenant_branches (
  tenant_id,
  codigo,
  nombre,
  descripcion,
  es_principal,
  direccion,
  ciudad,
  departamento,
  pais,
  telefono,
  email,
  estado
)
SELECT
  tenant_id,
  'PRINCIPAL',
  'Sucursal Principal',
  'Sucursal principal del tenant',
  TRUE,
  direccion_principal,
  ciudad,
  departamento,
  pais,
  telefono,
  email_corporativo,
  'ACTIVE'
FROM tenants_detalles
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (
    SELECT 1
    FROM tenant_branches
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
      AND es_principal = TRUE
  );


CREATE TABLE IF NOT EXISTS paises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_iso2 CHAR(2) NOT NULL UNIQUE,
  codigo_iso3 CHAR(3) NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  moneda TEXT,
  simbolo_moneda TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_paises_nombre ON paises (LOWER(nombre));

CREATE TABLE IF NOT EXISTS departamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pais_id UUID NOT NULL REFERENCES paises(id) ON DELETE RESTRICT,
  codigo_dane CHAR(2) NOT NULL,
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pais_id, codigo_dane)
);

CREATE INDEX idx_departamentos_pais ON departamentos(pais_id);
CREATE UNIQUE INDEX idx_departamentos_nombre
  ON departamentos (pais_id, LOWER(nombre));

CREATE TABLE IF NOT EXISTS municipios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento_id UUID NOT NULL REFERENCES departamentos(id) ON DELETE RESTRICT,
  codigo_dane CHAR(5) NOT NULL,
  nombre TEXT NOT NULL,
  es_capital BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (departamento_id, codigo_dane)
);

CREATE INDEX idx_municipios_departamento ON municipios(departamento_id);
CREATE UNIQUE INDEX idx_municipios_nombre
  ON municipios (departamento_id, LOWER(nombre));

INSERT INTO paises (id, codigo_iso2, codigo_iso3, nombre, moneda, simbolo_moneda)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'CO',
  'COL',
  'Colombia',
  'COP',
  '$'
)
ON CONFLICT (codigo_iso2) DO NOTHING;

INSERT INTO departamentos (pais_id, codigo_dane, nombre)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '08',
  'Atlántico'
)
ON CONFLICT DO NOTHING;

INSERT INTO municipios (departamento_id, codigo_dane, nombre, es_capital)
SELECT
  d.id,
  '08001',
  'Barranquilla',
  TRUE
FROM departamentos d
WHERE d.codigo_dane = '08';

ALTER TABLE tenants_detalles
  ADD COLUMN pais_id UUID,
  ADD COLUMN departamento_id UUID,
  ADD COLUMN municipio_id UUID;

ALTER TABLE tenants_detalles
  ADD CONSTRAINT fk_tenant_pais
    FOREIGN KEY (pais_id) REFERENCES paises(id);

ALTER TABLE tenants_detalles
  ADD CONSTRAINT fk_tenant_departamento
    FOREIGN KEY (departamento_id) REFERENCES departamentos(id);

ALTER TABLE tenants_detalles
  ADD CONSTRAINT fk_tenant_municipio
    FOREIGN KEY (municipio_id) REFERENCES municipios(id);


ALTER TABLE tenant_branches
  ADD COLUMN pais_id UUID,
  ADD COLUMN departamento_id UUID,
  ADD COLUMN municipio_id UUID;

ALTER TABLE tenant_branches
  ADD FOREIGN KEY (pais_id) REFERENCES paises(id);
ALTER TABLE tenant_branches
  ADD FOREIGN KEY (departamento_id) REFERENCES departamentos(id);
ALTER TABLE tenant_branches
  ADD FOREIGN KEY (municipio_id) REFERENCES municipios(id);

UPDATE tenants_detalles td
SET
  pais_id = p.id,
  departamento_id = d.id,
  municipio_id = m.id
FROM paises p,
     departamentos d,
     municipios m
WHERE
  p.nombre = td.pais
  AND d.nombre = td.departamento
  AND m.nombre = td.ciudad
  AND d.pais_id = p.id
  AND m.departamento_id = d.id;


ALTER TABLE tenants_detalles
  ALTER COLUMN pais_id SET NOT NULL,
  ALTER COLUMN departamento_id SET NOT NULL,
  ALTER COLUMN municipio_id SET NOT NULL;

-- =========================================
-- DEPARTAMENTOS DE COLOMBIA (DANE OFICIAL)
-- =========================================
INSERT INTO departamentos (pais_id, codigo_dane, nombre)
SELECT p.id, d.codigo, d.nombre
FROM paises p
CROSS JOIN (
  VALUES
    ('05','Antioquia'),
    ('08','Atlántico'),
    ('11','Bogotá D.C.'),
    ('13','Bolívar'),
    ('15','Boyacá'),
    ('17','Caldas'),
    ('18','Caquetá'),
    ('19','Cauca'),
    ('20','Cesar'),
    ('23','Córdoba'),
    ('25','Cundinamarca'),
    ('27','Chocó'),
    ('41','Huila'),
    ('44','La Guajira'),
    ('47','Magdalena'),
    ('50','Meta'),
    ('52','Nariño'),
    ('54','Norte de Santander'),
    ('63','Quindío'),
    ('66','Risaralda'),
    ('68','Santander'),
    ('70','Sucre'),
    ('73','Tolima'),
    ('76','Valle del Cauca'),
    ('81','Arauca'),
    ('85','Casanare'),
    ('86','Putumayo'),
    ('88','Archipiélago de San Andrés, Providencia y Santa Catalina'),
    ('91','Amazonas'),
    ('94','Guainía'),
    ('95','Guaviare'),
    ('97','Vaupés'),
    ('99','Vichada')
) AS d(codigo, nombre)
WHERE p.codigo_iso2 = 'CO'
ON CONFLICT (pais_id, codigo_dane) DO NOTHING;

CREATE OR REPLACE VIEW vw_direcciones_completas AS
SELECT
  pa.id           AS pais_id,
  pa.codigo_iso2  AS pais_codigo,
  pa.nombre       AS pais_nombre,
  d.id            AS departamento_id,
  d.codigo_dane   AS departamento_codigo_dane,
  d.nombre        AS departamento_nombre,
  m.id            AS municipio_id,
  m.codigo_dane   AS municipio_codigo_dane,
  m.nombre        AS municipio_nombre,
  m.es_capital
FROM paises pa
JOIN departamentos d ON d.pais_id = pa.id
JOIN municipios m    ON m.departamento_id = d.id
WHERE pa.activo = TRUE
  AND d.activo = TRUE
  AND m.activo = TRUE;

CREATE OR REPLACE VIEW vw_tenant_direcciones AS
SELECT
  t.id              AS tenant_id,
  t.slug            AS tenant_slug,
  t.nombre          AS tenant_nombre,
  td.razon_social,
  td.direccion_principal,
  pa.nombre         AS pais,
  d.nombre          AS departamento,
  m.nombre          AS municipio,
  pa.codigo_iso2    AS pais_codigo,
  d.codigo_dane     AS departamento_dane,
  m.codigo_dane     AS municipio_dane,
  td.telefono,
  td.email_corporativo,
  td.sitio_web
FROM tenants t
JOIN tenants_detalles td ON td.tenant_id = t.id
JOIN paises pa ON pa.id = td.pais_id
JOIN departamentos d ON d.id = td.departamento_id
JOIN municipios m ON m.id = td.municipio_id;  

CREATE TEMP TABLE tmp_municipios (
  codigo_dane CHAR(5),
  nombre TEXT,
  es_capital BOOLEAN DEFAULT FALSE
);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('08001','Barranquilla', TRUE),
('08078','Baranoa', FALSE),
('08137','Campo de la Cruz', FALSE),
('08141','Candelaria', FALSE),
('08296','Galapa', FALSE),
('08372','Juan de Acosta', FALSE),
('08421','Luruaco', FALSE),
('08433','Malambo', FALSE),
('08436','Manatí', FALSE),
('08520','Palmar de Varela', FALSE),
('08549','Piojó', FALSE),
('08558','Polonuevo', FALSE),
('08560','Ponedera', FALSE),
('08573','Puerto Colombia', FALSE),
('08606','Repelón', FALSE),
('08634','Sabanagrande', FALSE),
('08638','Sabanalarga', FALSE),
('08675','Santa Lucía', FALSE),
('08685','Santo Tomás', FALSE),
('08758','Soledad', FALSE),
('08770','Suan', FALSE),
('08832','Tubará', FALSE),
('08849','Usiacurí', FALSE);


INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('05001','Medellín', TRUE),
('05002','Abejorral', FALSE),
('05004','Abriaquí', FALSE),
('05021','Alejandría', FALSE),
('05030','Amagá', FALSE),
('05031','Amalfi', FALSE),
('05034','Andes', FALSE),
('05036','Angelópolis', FALSE),
('05038','Angostura', FALSE),
('05040','Anorí', FALSE),
('05042','Santa Fe de Antioquia', FALSE),
('05044','Anza', FALSE),
('05045','Apartadó', FALSE),
('05051','Arboletes', FALSE),
('05055','Argelia', FALSE);


INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('11001','Bogotá D.C.', TRUE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('13001','Cartagena de Indias', TRUE),
('13006','Achí', FALSE),
('13030','Altos del Rosario', FALSE),
('13042','Arenal', FALSE),
('13052','Arjona', FALSE),
('13062','Arroyohondo', FALSE),
('13074','Barranco de Loba', FALSE),
('13140','Calamar', FALSE),
('13160','Cantagallo', FALSE),
('13188','Cicuco', FALSE),
('13212','Córdoba', FALSE),
('13222','Clemencia', FALSE);


INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('25001','Agua de Dios', FALSE),
('25019','Albán', FALSE),
('25035','Anapoima', FALSE),
('25040','Anolaima', FALSE),
('25053','Arbeláez', FALSE),
('25086','Beltrán', FALSE),
('25095','Bituima', FALSE),
('25099','Bojacá', FALSE),
('25120','Cabrera', FALSE),
('25123','Cachipay', FALSE),
('25126','Cajicá', FALSE),
('25148','Caparrapí', FALSE),
('25151','Caqueza', FALSE),
('25154','Carmen de Carupa', FALSE),
('25168','Chaguaní', FALSE),
('25175','Chía', FALSE),
('25178','Chipaque', FALSE),
('25181','Choachí', FALSE),
('25183','Chocontá', FALSE),
('25200','Cogua', FALSE),
('25214','Cota', FALSE),
('25224','Cucunubá', FALSE),
('25245','El Colegio', FALSE),
('25258','El Peñón', FALSE),
('25260','El Rosal', FALSE),
('25269','Facatativá', FALSE),
('25279','Fómeque', FALSE),
('25281','Fosca', FALSE),
('25286','Funza', FALSE),
('25288','Fúquene', FALSE),
('25290','Fusagasugá', FALSE),
('25293','Gachalá', FALSE),
('25295','Gachancipá', FALSE),
('25297','Gachetá', FALSE),
('25299','Gama', FALSE),
('25307','Girardot', FALSE),
('25312','Granada', FALSE),
('25317','Guachetá', FALSE),
('25320','Guaduas', FALSE),
('25322','Guasca', FALSE),
('25324','Guataquí', FALSE),
('25326','Guatavita', FALSE),
('25328','Guayabal de Síquima', FALSE),
('25335','Guayabetal', FALSE),
('25339','Gutiérrez', FALSE),
('25368','Jerusalén', FALSE),
('25372','Junín', FALSE),
('25377','La Calera', FALSE),
('25386','La Mesa', FALSE),
('25394','La Palma', FALSE),
('25398','La Peña', FALSE),
('25402','La Vega', FALSE),
('25407','Lenguazaque', FALSE),
('25426','Machetá', FALSE),
('25430','Madrid', FALSE),
('25436','Manta', FALSE),
('25438','Medina', FALSE),
('25473','Mosquera', FALSE),
('25483','Nariño', FALSE),
('25486','Nemocón', FALSE),
('25488','Nilo', FALSE),
('25489','Nimaima', FALSE),
('25491','Nocaima', FALSE),
('25506','Venecia', FALSE),
('25513','Pacho', FALSE),
('25518','Paime', FALSE),
('25524','Pandi', FALSE),
('25530','Paratebueno', FALSE),
('25535','Pasca', FALSE),
('25572','Puerto Salgar', FALSE),
('25580','Pulí', FALSE),
('25592','Quebradanegra', FALSE),
('25594','Quetame', FALSE),
('25596','Quipile', FALSE),
('25599','Apulo', FALSE),
('25612','Ricaurte', FALSE),
('25645','San Antonio del Tequendama', FALSE),
('25649','San Bernardo', FALSE),
('25653','San Cayetano', FALSE),
('25658','San Francisco', FALSE),
('25662','San Juan de Río Seco', FALSE),
('25718','Sasaima', FALSE),
('25736','Sesquilé', FALSE),
('25740','Sibaté', FALSE),
('25743','Silvania', FALSE),
('25745','Simijaca', FALSE),
('25754','Soacha', FALSE),
('25758','Sopó', FALSE),
('25769','Subachoque', FALSE),
('25772','Suesca', FALSE),
('25777','Supatá', FALSE),
('25779','Susa', FALSE),
('25781','Sutatausa', FALSE),
('25785','Tabio', FALSE),
('25793','Tausa', FALSE),
('25797','Tena', FALSE),
('25799','Tenjo', FALSE),
('25805','Tibacuy', FALSE),
('25807','Tibirita', FALSE),
('25815','Tocaima', FALSE),
('25817','Tocancipá', FALSE),
('25823','Topaipí', FALSE),
('25839','Ubalá', FALSE),
('25841','Ubaque', FALSE),
('25843','Villa de San Diego de Ubaté', FALSE),
('25845','Une', FALSE),
('25851','Útica', FALSE),
('25862','Vergara', FALSE),
('25867','Vianí', FALSE),
('25871','Villagómez', FALSE),
('25873','Villapinzón', FALSE),
('25875','Villeta', FALSE),
('25878','Viotá', FALSE),
('25885','Yacopí', FALSE),
('25898','Zipacón', FALSE),
('25899','Zipaquirá', FALSE);


-- ================================
-- DEPARTAMENTO 15 - BOYACÁ
-- ================================
INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('15001','Tunja', TRUE),
('15022','Almeida', FALSE),
('15047','Aquitania', FALSE),
('15051','Arcabuco', FALSE),
('15087','Belén', FALSE),
('15090','Berbeo', FALSE),
('15092','Betéitiva', FALSE),
('15097','Boavita', FALSE),
('15104','Boyacá', FALSE),
('15106','Briceño', FALSE),
('15109','Buena Vista', FALSE),
('15114','Busbanzá', FALSE),
('15131','Caldas', FALSE),
('15135','Campohermoso', FALSE),
('15162','Cerinza', FALSE),
('15172','Chinavita', FALSE),
('15176','Chiquinquirá', FALSE),
('15180','Chiscas', FALSE),
('15183','Chita', FALSE),
('15185','Chitaraque', FALSE),
('15187','Chivatá', FALSE),
('15189','Ciénega', FALSE),
('15204','Cómbita', FALSE),
('15212','Coper', FALSE),
('15215','Corrales', FALSE),
('15218','Covarachía', FALSE),
('15223','Cubará', FALSE),
('15224','Cucaita', FALSE),
('15226','Cuítiva', FALSE),
('15232','Chíquiza', FALSE),
('15236','Chivor', FALSE),
('15238','Duitama', FALSE),
('15244','El Cocuy', FALSE),
('15248','El Espino', FALSE),
('15272','Firavitoba', FALSE),
('15276','Floresta', FALSE),
('15293','Gachantivá', FALSE),
('15296','Gameza', FALSE),
('15299','Garagoa', FALSE),
('15317','Guacamayas', FALSE),
('15322','Guateque', FALSE),
('15325','Guayatá', FALSE),
('15332','Güicán de la Sierra', FALSE),
('15362','Iza', FALSE),
('15367','Jenesano', FALSE),
('15368','Jericó', FALSE),
('15377','Labranzagrande', FALSE),
('15380','La Capilla', FALSE),
('15401','La Victoria', FALSE),
('15403','La Uvita', FALSE),
('15407','Villa de Leyva', FALSE),
('15425','Macanal', FALSE),
('15442','Maripí', FALSE),
('15455','Miraflores', FALSE),
('15464','Mongua', FALSE),
('15466','Monguí', FALSE),
('15469','Moniquirá', FALSE),
('15476','Motavita', FALSE),
('15480','Muzo', FALSE),
('15491','Nobsa', FALSE),
('15494','Nuevo Colón', FALSE),
('15500','Oicatá', FALSE),
('15507','Otanche', FALSE),
('15511','Pachavita', FALSE),
('15514','Páez', FALSE),
('15516','Paipa', FALSE),
('15518','Pajarito', FALSE),
('15522','Panqueba', FALSE),
('15531','Pauna', FALSE),
('15533','Paya', FALSE),
('15537','Paz de Río', FALSE),
('15542','Pesca', FALSE),
('15550','Pisba', FALSE),
('15572','Puerto Boyacá', FALSE),
('15580','Quípama', FALSE),
('15599','Ramiriquí', FALSE),
('15600','Ráquira', FALSE),
('15621','Rondón', FALSE),
('15632','Saboyá', FALSE),
('15638','Sáchica', FALSE),
('15646','Samacá', FALSE),
('15660','San Eduardo', FALSE),
('15664','San José de Pare', FALSE),
('15667','San Luis de Gaceno', FALSE),
('15673','San Mateo', FALSE),
('15676','San Miguel de Sema', FALSE),
('15681','San Pablo de Borbur', FALSE),
('15686','Santana', FALSE),
('15690','Santa María', FALSE),
('15693','Santa Rosa de Viterbo', FALSE),
('15696','Santa Sofía', FALSE),
('15720','Sativanorte', FALSE),
('15723','Sativasur', FALSE),
('15740','Siachoque', FALSE),
('15753','Soatá', FALSE),
('15755','Socotá', FALSE),
('15757','Socha', FALSE),
('15759','Sogamoso', FALSE),
('15761','Somondoco', FALSE),
('15762','Sora', FALSE),
('15763','Sotaquirá', FALSE),
('15764','Soracá', FALSE),
('15774','Susacón', FALSE),
('15776','Sutamarchán', FALSE),
('15778','Sutatenza', FALSE),
('15790','Tasco', FALSE),
('15798','Tenza', FALSE),
('15804','Tibaná', FALSE),
('15806','Tibasosa', FALSE),
('15808','Tinjacá', FALSE),
('15810','Tipacoque', FALSE),
('15814','Toca', FALSE),
('15816','Togüí', FALSE),
('15820','Tópaga', FALSE),
('15822','Tota', FALSE),
('15832','Tununguá', FALSE),
('15835','Turmequé', FALSE),
('15837','Tuta', FALSE),
('15839','Tutazá', FALSE),
('15842','Umbita', FALSE),
('15861','Ventaquemada', FALSE),
('15879','Viracachá', FALSE),
('15897','Zetaquira', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('17001','Manizales', TRUE),
('17013','Aguadas', FALSE),
('17042','Anserma', FALSE),
('17050','Aranzazu', FALSE),
('17088','Belalcázar', FALSE),
('17174','Chinchiná', FALSE),
('17272','Filadelfia', FALSE),
('17380','La Dorada', FALSE),
('17388','La Merced', FALSE),
('17433','Manzanares', FALSE),
('17442','Marmato', FALSE),
('17444','Marquetalia', FALSE),
('17446','Marulanda', FALSE),
('17486','Neira', FALSE),
('17495','Norcasia', FALSE),
('17513','Pácora', FALSE),
('17524','Palestina', FALSE),
('17541','Pensilvania', FALSE),
('17614','Riosucio', FALSE),
('17616','Risaralda', FALSE),
('17653','Salamina', FALSE),
('17662','Samaná', FALSE),
('17665','San José', FALSE),
('17777','Supía', FALSE),
('17867','Victoria', FALSE),
('17873','Villamaría', FALSE),
('17877','Viterbo', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('18001','Florencia', TRUE),
('18029','Albania', FALSE),
('18094','Belén de los Andaquíes', FALSE),
('18150','Cartagena del Chairá', FALSE),
('18205','Curillo', FALSE),
('18247','El Doncello', FALSE),
('18256','El Paujil', FALSE),
('18410','La Montañita', FALSE),
('18460','Milán', FALSE),
('18479','Morelia', FALSE),
('18592','Puerto Rico', FALSE),
('18610','San José del Fragua', FALSE),
('18753','San Vicente del Caguán', FALSE),
('18756','Solano', FALSE),
('18785','Solita', FALSE),
('18860','Valparaíso', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('19001','Popayán', TRUE),
('19022','Almaguer', FALSE),
('19050','Argelia', FALSE),
('19075','Balboa', FALSE),
('19100','Bolívar', FALSE),
('19110','Buenos Aires', FALSE),
('19130','Cajibío', FALSE),
('19137','Caldono', FALSE),
('19142','Caloto', FALSE),
('19212','Corinto', FALSE),
('19256','El Tambo', FALSE),
('19290','Florencia', FALSE),
('19318','Guapi', FALSE),
('19355','Inzá', FALSE),
('19364','Jambaló', FALSE),
('19392','La Sierra', FALSE),
('19397','La Vega', FALSE),
('19418','López de Micay', FALSE),
('19450','Mercaderes', FALSE),
('19455','Miranda', FALSE),
('19473','Morales', FALSE),
('19513','Padilla', FALSE),
('19517','Páez', FALSE),
('19532','Patía', FALSE),
('19533','Piamonte', FALSE),
('19548','Piendamó', FALSE),
('19573','Puerto Tejada', FALSE),
('19585','Puracé', FALSE),
('19622','Rosas', FALSE),
('19693','San Sebastián', FALSE),
('19698','Santander de Quilichao', FALSE),
('19701','Santa Rosa', FALSE),
('19743','Silvia', FALSE),
('19760','Sotará', FALSE),
('19780','Suárez', FALSE),
('19785','Sucre', FALSE),
('19807','Timbío', FALSE),
('19809','Timbiquí', FALSE),
('19821','Toribío', FALSE),
('19824','Totoró', FALSE),
('19845','Villa Rica', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('20001','Valledupar', TRUE),
('20011','Aguachica', FALSE),
('20013','Agustín Codazzi', FALSE),
('20032','Astrea', FALSE),
('20045','Becerril', FALSE),
('20060','Bosconia', FALSE),
('20175','Chimichagua', FALSE),
('20178','Chiriguaná', FALSE),
('20228','Curumaní', FALSE),
('20238','El Copey', FALSE),
('20250','El Paso', FALSE),
('20295','Gamarra', FALSE),
('20310','González', FALSE),
('20383','La Gloria', FALSE),
('20400','La Jagua de Ibirico', FALSE),
('20443','Manaure Balcón del Cesar', FALSE),
('20517','Pailitas', FALSE),
('20550','Pelaya', FALSE),
('20570','Pueblo Bello', FALSE),
('20614','Río de Oro', FALSE),
('20621','La Paz', FALSE),
('20710','San Alberto', FALSE),
('20750','San Diego', FALSE),
('20770','San Martín', FALSE),
('20787','Tamalameque', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('23001','Montería', TRUE),
('23068','Ayapel', FALSE),
('23079','Buenavista', FALSE),
('23090','Canalete', FALSE),
('23162','Cereté', FALSE),
('23168','Chimá', FALSE),
('23182','Chinú', FALSE),
('23189','Ciénaga de Oro', FALSE),
('23300','Cotorra', FALSE),
('23350','La Apartada', FALSE),
('23417','Lorica', FALSE),
('23419','Los Córdobas', FALSE),
('23464','Momil', FALSE),
('23466','Montelíbano', FALSE),
('23500','Moñitos', FALSE),
('23555','Planeta Rica', FALSE),
('23570','Pueblo Nuevo', FALSE),
('23574','Puerto Escondido', FALSE),
('23580','Puerto Libertador', FALSE),
('23586','Purísima', FALSE),
('23660','Sahagún', FALSE),
('23670','San Andrés de Sotavento', FALSE),
('23672','San Antero', FALSE),
('23675','San Bernardo del Viento', FALSE),
('23678','San Carlos', FALSE),
('23682','San José de Uré', FALSE),
('23686','San Pelayo', FALSE),
('23807','Tierralta', FALSE),
('23815','Tuchín', FALSE),
('23855','Valencia', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('25001','Agua de Dios', FALSE),
('25019','Albán', FALSE),
('25035','Anapoima', FALSE),
('25040','Anolaima', FALSE),
('25053','Arbeláez', FALSE),
('25086','Beltrán', FALSE),
('25095','Bituima', FALSE),
('25099','Bojacá', FALSE),
('25120','Cabrera', FALSE),
('25123','Cachipay', FALSE),
('25126','Cajicá', FALSE),
('25148','Caparrapí', FALSE),
('25151','Cáqueza', FALSE),
('25154','Carmen de Carupa', FALSE),
('25168','Chaguaní', FALSE),
('25175','Chía', FALSE),
('25178','Chipaque', FALSE),
('25181','Choachí', FALSE),
('25183','Chocontá', FALSE),
('25200','Cogua', FALSE),
('25214','Cota', FALSE),
('25224','Cucunubá', FALSE),
('25245','El Colegio', FALSE),
('25258','El Peñón', FALSE),
('25260','El Rosal', FALSE),
('25269','Facatativá', FALSE),
('25279','Fómeque', FALSE),
('25281','Fosca', FALSE),
('25286','Funza', FALSE),
('25288','Fúquene', FALSE),
('25290','Fusagasugá', FALSE),
('25293','Gachalá', FALSE),
('25295','Gachancipá', FALSE),
('25297','Gachetá', FALSE),
('25299','Gama', FALSE),
('25307','Girardot', FALSE),
('25312','Granada', FALSE),
('25317','Guachetá', FALSE),
('25320','Guaduas', FALSE),
('25322','Guasca', FALSE),
('25324','Guataquí', FALSE),
('25326','Guatavita', FALSE),
('25328','Guayabal de Síquima', FALSE),
('25335','Guayabetal', FALSE),
('25339','Gutiérrez', FALSE),
('25368','Jerusalén', FALSE),
('25372','Junín', FALSE),
('25377','La Calera', FALSE),
('25386','La Mesa', FALSE),
('25394','La Palma', FALSE),
('25398','La Peña', FALSE),
('25402','La Vega', FALSE),
('25407','Lenguazaque', FALSE),
('25426','Machetá', FALSE),
('25430','Madrid', FALSE),
('25436','Manta', FALSE),
('25438','Medina', FALSE),
('25473','Mosquera', FALSE),
('25483','Nariño', FALSE),
('25486','Nemocón', FALSE),
('25488','Nilo', FALSE),
('25489','Nimaima', FALSE),
('25491','Nocaima', FALSE),
('25506','Venecia', FALSE),
('25513','Pacho', FALSE),
('25518','Paime', FALSE),
('25524','Pandi', FALSE),
('25530','Paratebueno', FALSE),
('25535','Pasca', FALSE),
('25572','Puerto Salgar', FALSE),
('25580','Pulí', FALSE),
('25592','Quebradanegra', FALSE),
('25594','Quetame', FALSE),
('25596','Quipile', FALSE),
('25599','Apulo', FALSE),
('25612','Ricaurte', FALSE),
('25645','San Antonio del Tequendama', FALSE),
('25649','San Bernardo', FALSE),
('25653','San Cayetano', FALSE),
('25658','San Francisco', FALSE),
('25662','San Juan de Rioseco', FALSE),
('25718','Sasaima', FALSE),
('25736','Sesquilé', FALSE),
('25740','Sibaté', FALSE),
('25743','Silvania', FALSE),
('25745','Simijaca', FALSE),
('25754','Soacha', FALSE),
('25758','Sopó', FALSE),
('25769','Subachoque', FALSE),
('25772','Suesca', FALSE),
('25777','Supatá', FALSE),
('25779','Susa', FALSE),
('25781','Sutatausa', FALSE),
('25785','Tabio', FALSE),
('25793','Tausa', FALSE),
('25797','Tena', FALSE),
('25799','Tenjo', FALSE),
('25805','Tibacuy', FALSE),
('25807','Tibirita', FALSE),
('25815','Tocaima', FALSE),
('25817','Tocancipá', FALSE),
('25823','Topaipí', FALSE),
('25839','Ubalá', FALSE),
('25841','Ubaque', FALSE),
('25843','Villa de San Diego de Ubaté', FALSE),
('25845','Une', FALSE),
('25851','Útica', FALSE),
('25862','Vergara', FALSE),
('25867','Vianí', FALSE),
('25871','Villagómez', FALSE),
('25873','Villapinzón', FALSE),
('25875','Villeta', FALSE),
('25878','Viotá', FALSE),
('25885','Yacopí', FALSE),
('25898','Zipacón', FALSE),
('25899','Zipaquirá', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('27001','Quibdó', TRUE),
('27006','Acandí', FALSE),
('27025','Alto Baudó', FALSE),
('27050','Atrato', FALSE),
('27073','Bagadó', FALSE),
('27075','Bahía Solano', FALSE),
('27077','Bajo Baudó', FALSE),
('27099','Bojayá', FALSE),
('27135','Cantón de San Pablo', FALSE),
('27150','Carmen del Darién', FALSE),
('27160','Cértegui', FALSE),
('27205','Condoto', FALSE),
('27245','El Carmen de Atrato', FALSE),
('27250','El Litoral del San Juan', FALSE),
('27361','Istmina', FALSE),
('27372','Juradó', FALSE),
('27413','Lloró', FALSE),
('27425','Medio Atrato', FALSE),
('27430','Medio Baudó', FALSE),
('27450','Medio San Juan', FALSE),
('27491','Nóvita', FALSE),
('27495','Nuquí', FALSE),
('27580','Río Iró', FALSE),
('27600','Río Quito', FALSE),
('27615','Riosucio', FALSE),
('27660','San José del Palmar', FALSE),
('27745','Sipí', FALSE),
('27787','Tadó', FALSE),
('27800','Unguía', FALSE),
('27810','Unión Panamericana', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('41001','Neiva', TRUE),
('41006','Acevedo', FALSE),
('41013','Agrado', FALSE),
('41016','Aipe', FALSE),
('41020','Algeciras', FALSE),
('41026','Altamira', FALSE),
('41078','Baraya', FALSE),
('41132','Campoalegre', FALSE),
('41206','Colombia', FALSE),
('41244','Elías', FALSE),
('41298','Garzón', FALSE),
('41306','Gigante', FALSE),
('41319','Guadalupe', FALSE),
('41349','Hobo', FALSE),
('41357','Íquira', FALSE),
('41359','Isnos', FALSE),
('41378','La Argentina', FALSE),
('41396','La Plata', FALSE),
('41483','Nátaga', FALSE),
('41503','Oporapa', FALSE),
('41518','Paicol', FALSE),
('41524','Palermo', FALSE),
('41530','Palestina', FALSE),
('41548','Pital', FALSE),
('41551','Pitalito', FALSE),
('41615','Rivera', FALSE),
('41660','Saladoblanco', FALSE),
('41668','San Agustín', FALSE),
('41676','Santa María', FALSE),
('41770','Suaza', FALSE),
('41791','Tarqui', FALSE),
('41797','Tesalia', FALSE),
('41799','Tello', FALSE),
('41801','Teruel', FALSE),
('41807','Timaná', FALSE),
('41872','Villavieja', FALSE),
('41885','Yaguará', FALSE);


INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('41001','Neiva', TRUE),
('41006','Acevedo', FALSE),
('41013','Agrado', FALSE),
('41016','Aipe', FALSE),
('41020','Algeciras', FALSE),
('41026','Altamira', FALSE),
('41078','Baraya', FALSE),
('41132','Campoalegre', FALSE),
('41206','Colombia', FALSE),
('41244','Elías', FALSE),
('41298','Garzón', FALSE),
('41306','Gigante', FALSE),
('41319','Guadalupe', FALSE),
('41349','Hobo', FALSE),
('41357','Íquira', FALSE),
('41359','Isnos', FALSE),
('41378','La Argentina', FALSE),
('41396','La Plata', FALSE),
('41483','Nátaga', FALSE),
('41503','Oporapa', FALSE),
('41518','Paicol', FALSE),
('41524','Palermo', FALSE),
('41530','Palestina', FALSE),
('41548','Pital', FALSE),
('41551','Pitalito', FALSE),
('41615','Rivera', FALSE),
('41660','Saladoblanco', FALSE),
('41668','San Agustín', FALSE),
('41676','Santa María', FALSE),
('41770','Suaza', FALSE),
('41791','Tarqui', FALSE),
('41797','Tesalia', FALSE),
('41799','Tello', FALSE),
('41801','Teruel', FALSE),
('41807','Timaná', FALSE),
('41872','Villavieja', FALSE),
('41885','Yaguará', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('44001','Riohacha', TRUE),
('44035','Albania', FALSE),
('44078','Barrancas', FALSE),
('44090','Dibulla', FALSE),
('44098','Distracción', FALSE),
('44110','El Molino', FALSE),
('44279','Fonseca', FALSE),
('44378','Hatonuevo', FALSE),
('44420','La Jagua del Pilar', FALSE),
('44430','Maicao', FALSE),
('44560','Manaure', FALSE),
('44650','San Juan del Cesar', FALSE),
('44847','Uribia', FALSE),
('44855','Urumita', FALSE),
('44874','Villanueva', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('47001','Santa Marta', TRUE),
('47030','Algarrobo', FALSE),
('47053','Aracataca', FALSE),
('47058','Ariguaní', FALSE),
('47161','Cerro de San Antonio', FALSE),
('47170','Chivolo', FALSE),
('47189','Ciénaga', FALSE),
('47205','Concordia', FALSE),
('47245','El Banco', FALSE),
('47258','El Piñón', FALSE),
('47268','El Retén', FALSE),
('47288','Fundación', FALSE),
('47318','Guamal', FALSE),
('47460','Nueva Granada', FALSE),
('47541','Pedraza', FALSE),
('47545','Pijiño del Carmen', FALSE),
('47551','Pivijay', FALSE),
('47555','Plato', FALSE),
('47570','Puebloviejo', FALSE),
('47605','Remolino', FALSE),
('47660','Sabanas de San Ángel', FALSE),
('47675','Salamina', FALSE),
('47692','San Sebastián de Buenavista', FALSE),
('47703','San Zenón', FALSE),
('47707','Santa Ana', FALSE),
('47720','Santa Bárbara de Pinto', FALSE),
('47745','Sitionuevo', FALSE),
('47798','Tenerife', FALSE),
('47960','Zapayán', FALSE),
('47980','Zona Bananera', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('50001','Villavicencio', TRUE),
('50006','Acacías', FALSE),
('50110','Barranca de Upía', FALSE),
('50124','Cabuyaro', FALSE),
('50150','Castilla la Nueva', FALSE),
('50223','Cubarral', FALSE),
('50226','Cumaral', FALSE),
('50245','El Calvario', FALSE),
('50251','El Castillo', FALSE),
('50270','El Dorado', FALSE),
('50287','Fuente de Oro', FALSE),
('50313','Granada', FALSE),
('50318','Guamal', FALSE),
('50325','Mapiripán', FALSE),
('50330','Mesetas', FALSE),
('50350','La Macarena', FALSE),
('50370','La Uribe', FALSE),
('50400','Lejanías', FALSE),
('50450','Puerto Concordia', FALSE),
('50568','Puerto Gaitán', FALSE),
('50573','Puerto López', FALSE),
('50577','Puerto Lleras', FALSE),
('50590','Puerto Rico', FALSE),
('50606','Restrepo', FALSE),
('50680','San Carlos de Guaroa', FALSE),
('50683','San Juan de Arama', FALSE),
('50686','San Juanito', FALSE),
('50689','San Martín', FALSE),
('50711','Vista Hermosa', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('52001','Pasto', TRUE),
('52019','Albán', FALSE),
('52022','Aldana', FALSE),
('52036','Ancuyá', FALSE),
('52051','Arboleda', FALSE),
('52079','Barbacoas', FALSE),
('52083','Belén', FALSE),
('52110','Buesaco', FALSE),
('52203','Colón', FALSE),
('52207','Consacá', FALSE),
('52210','Contadero', FALSE),
('52215','Córdoba', FALSE),
('52224','Cuaspud', FALSE),
('52227','Cumbal', FALSE),
('52233','Cumbitara', FALSE),
('52240','Chachagüí', FALSE),
('52250','El Charco', FALSE),
('52254','El Peñol', FALSE),
('52256','El Rosario', FALSE),
('52258','El Tablón de Gómez', FALSE),
('52260','El Tambo', FALSE),
('52287','Funes', FALSE),
('52317','Guachucal', FALSE),
('52320','Guaitarilla', FALSE),
('52323','Gualmatán', FALSE),
('52352','Iles', FALSE),
('52354','Imués', FALSE),
('52356','Ipiales', FALSE),
('52378','La Cruz', FALSE),
('52381','La Florida', FALSE),
('52385','La Llanada', FALSE),
('52390','La Tola', FALSE),
('52399','La Unión', FALSE),
('52405','Leiva', FALSE),
('52411','Linares', FALSE),
('52418','Los Andes', FALSE),
('52427','Magüí', FALSE),
('52435','Mallama', FALSE),
('52473','Mosquera', FALSE),
('52480','Nariño', FALSE),
('52490','Olaya Herrera', FALSE),
('52506','Ospina', FALSE),
('52520','Francisco Pizarro', FALSE),
('52540','Policarpa', FALSE),
('52560','Potosí', FALSE),
('52565','Providencia', FALSE),
('52573','Puerres', FALSE),
('52585','Pupiales', FALSE),
('52612','Ricaurte', FALSE),
('52621','Roberto Payán', FALSE),
('52678','Samaniego', FALSE),
('52683','Sandoná', FALSE),
('52685','San Bernardo', FALSE),
('52687','San Lorenzo', FALSE),
('52693','San Pablo', FALSE),
('52694','San Pedro de Cartago', FALSE),
('52696','Santa Bárbara', FALSE),
('52699','Santacruz', FALSE),
('52720','Sapuyes', FALSE),
('52786','Taminango', FALSE),
('52788','Tangua', FALSE),
('52835','Tumaco', FALSE),
('52838','Túquerres', FALSE),
('52885','Yacuanquer', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('54001','Cúcuta', TRUE),
('54003','Abrego', FALSE),
('54051','Arboledas', FALSE),
('54099','Bochalema', FALSE),
('54109','Bucarasica', FALSE),
('54125','Cácota', FALSE),
('54128','Cachirá', FALSE),
('54172','Chinácota', FALSE),
('54174','Chitagá', FALSE),
('54206','Convención', FALSE),
('54223','Cucutilla', FALSE),
('54239','Durania', FALSE),
('54245','El Carmen', FALSE),
('54250','El Tarra', FALSE),
('54261','El Zulia', FALSE),
('54313','Gramalote', FALSE),
('54344','Hacarí', FALSE),
('54347','Herrán', FALSE),
('54377','Labateca', FALSE),
('54385','La Esperanza', FALSE),
('54398','La Playa', FALSE),
('54405','Los Patios', FALSE),
('54418','Lourdes', FALSE),
('54480','Mutiscua', FALSE),
('54498','Ocaña', FALSE),
('54518','Pamplona', FALSE),
('54520','Pamplonita', FALSE),
('54553','Puerto Santander', FALSE),
('54599','Ragonvalia', FALSE),
('54660','Salazar', FALSE),
('54670','San Calixto', FALSE),
('54673','San Cayetano', FALSE),
('54680','Santiago', FALSE),
('54720','Sardinata', FALSE),
('54743','Silos', FALSE),
('54800','Teorama', FALSE),
('54810','Tibú', FALSE),
('54820','Toledo', FALSE),
('54871','Villa Caro', FALSE),
('54874','Villa del Rosario', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('63001','Armenia', TRUE),
('63111','Buenavista', FALSE),
('63130','Calarcá', FALSE),
('63190','Circasia', FALSE),
('63212','Córdoba', FALSE),
('63272','Filandia', FALSE),
('63302','Génova', FALSE),
('63401','La Tebaida', FALSE),
('63470','Montenegro', FALSE),
('63548','Pijao', FALSE),
('63594','Quimbaya', FALSE),
('63690','Salento', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('66001','Pereira', TRUE),
('66045','Apía', FALSE),
('66075','Balboa', FALSE),
('66088','Belén de Umbría', FALSE),
('66170','Dosquebradas', FALSE),
('66318','Guática', FALSE),
('66383','La Celia', FALSE),
('66400','La Virginia', FALSE),
('66440','Marsella', FALSE),
('66456','Mistrató', FALSE),
('66572','Pueblo Rico', FALSE),
('66594','Quinchía', FALSE),
('66682','Santa Rosa de Cabal', FALSE),
('66687','Santuario', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('68001','Bucaramanga', TRUE),
('68013','Aguada', FALSE),
('68020','Albania', FALSE),
('68051','Aratoca', FALSE),
('68077','Barbosa', FALSE),
('68079','Barichara', FALSE),
('68081','Barrancabermeja', FALSE),
('68092','Betulia', FALSE),
('68101','Bolívar', FALSE),
('68121','Cabrera', FALSE),
('68132','California', FALSE),
('68147','Capitanejo', FALSE),
('68152','Carcasí', FALSE),
('68160','Cepitá', FALSE),
('68162','Cerrito', FALSE),
('68167','Charalá', FALSE),
('68169','Charta', FALSE),
('68176','Chima', FALSE),
('68179','Chipatá', FALSE),
('68190','Cimitarra', FALSE),
('68207','Concepción', FALSE),
('68209','Confines', FALSE),
('68211','Contratación', FALSE),
('68217','Coromoro', FALSE),
('68229','Curití', FALSE),
('68235','El Carmen de Chucurí', FALSE),
('68245','El Guacamayo', FALSE),
('68250','El Peñón', FALSE),
('68255','El Playón', FALSE),
('68264','Encino', FALSE),
('68266','Enciso', FALSE),
('68271','Florián', FALSE),
('68276','Floridablanca', FALSE),
('68296','Galán', FALSE),
('68298','Gámbita', FALSE),
('68307','Girón', FALSE),
('68318','Guaca', FALSE),
('68320','Guadalupe', FALSE),
('68322','Guapotá', FALSE),
('68324','Guavatá', FALSE),
('68327','Güepsa', FALSE),
('68344','Hato', FALSE),
('68368','Jesús María', FALSE),
('68370','Jordán', FALSE),
('68377','La Belleza', FALSE),
('68385','Landázuri', FALSE),
('68397','La Paz', FALSE),
('68406','Lebrija', FALSE),
('68418','Los Santos', FALSE),
('68425','Macaravita', FALSE),
('68432','Málaga', FALSE),
('68444','Matanza', FALSE),
('68464','Mogotes', FALSE),
('68468','Molagavita', FALSE),
('68498','Ocamonte', FALSE),
('68500','Oiba', FALSE),
('68502','Onzaga', FALSE),
('68522','Palmar', FALSE),
('68524','Palmas del Socorro', FALSE),
('68533','Páramo', FALSE),
('68547','Piedecuesta', FALSE),
('68549','Pinchote', FALSE),
('68572','Puente Nacional', FALSE),
('68573','Puerto Parra', FALSE),
('68575','Puerto Wilches', FALSE),
('68615','Rionegro', FALSE),
('68655','Sabana de Torres', FALSE),
('68669','San Andrés', FALSE),
('68673','San Benito', FALSE),
('68679','San Gil', FALSE),
('68682','San Joaquín', FALSE),
('68684','San José de Miranda', FALSE),
('68686','San Miguel', FALSE),
('68689','San Vicente de Chucurí', FALSE),
('68705','Santa Bárbara', FALSE),
('68720','Santa Helena del Opón', FALSE),
('68745','Simacota', FALSE),
('68755','Socorro', FALSE),
('68770','Suaita', FALSE),
('68773','Sucre', FALSE),
('68780','Suratá', FALSE),
('68820','Tona', FALSE),
('68855','Valle de San José', FALSE),
('68861','Vélez', FALSE),
('68867','Vetas', FALSE),
('68872','Villanueva', FALSE),
('68895','Zapatoca', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('70001','Sincelejo', TRUE),
('70110','Buenavista', FALSE),
('70124','Caimito', FALSE),
('70204','Colosó', FALSE),
('70215','Corozal', FALSE),
('70221','Coveñas', FALSE),
('70230','Chalán', FALSE),
('70233','El Roble', FALSE),
('70235','Galeras', FALSE),
('70265','Guaranda', FALSE),
('70400','La Unión', FALSE),
('70418','Los Palmitos', FALSE),
('70429','Majagual', FALSE),
('70473','Morroa', FALSE),
('70508','Ovejas', FALSE),
('70523','Palmito', FALSE),
('70670','Sampués', FALSE),
('70678','San Benito Abad', FALSE),
('70702','San Juan de Betulia', FALSE),
('70708','San Marcos', FALSE),
('70713','San Onofre', FALSE),
('70717','San Pedro', FALSE),
('70742','Sincé', FALSE),
('70771','Sucre', FALSE),
('70820','Tolú', FALSE),
('70823','Tolú Viejo', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('73001','Ibagué', TRUE),
('73024','Alpujarra', FALSE),
('73026','Alvarado', FALSE),
('73030','Ambalema', FALSE),
('73043','Anzoátegui', FALSE),
('73055','Armero', FALSE),
('73067','Ataco', FALSE),
('73124','Cajamarca', FALSE),
('73148','Carmen de Apicalá', FALSE),
('73152','Casabianca', FALSE),
('73168','Chaparral', FALSE),
('73200','Coello', FALSE),
('73217','Coyaima', FALSE),
('73226','Cunday', FALSE),
('73236','Dolores', FALSE),
('73268','Espinal', FALSE),
('73270','Falan', FALSE),
('73275','Flandes', FALSE),
('73283','Fresno', FALSE),
('73319','Guamo', FALSE),
('73347','Herveo', FALSE),
('73349','Honda', FALSE),
('73352','Icononzo', FALSE),
('73408','Lérida', FALSE),
('73411','Líbano', FALSE),
('73443','Mariquita', FALSE),
('73449','Melgar', FALSE),
('73461','Murillo', FALSE),
('73483','Natagaima', FALSE),
('73504','Ortega', FALSE),
('73520','Palocabildo', FALSE),
('73547','Piedras', FALSE),
('73555','Planadas', FALSE),
('73563','Prado', FALSE),
('73585','Purificación', FALSE),
('73616','Rio Blanco', FALSE),
('73622','Roncesvalles', FALSE),
('73624','Rovira', FALSE),
('73671','Saldaña', FALSE),
('73675','San Antonio', FALSE),
('73678','San Luis', FALSE),
('73686','Santa Isabel', FALSE),
('73770','Suárez', FALSE),
('73854','Valle de San Juan', FALSE),
('73861','Venadillo', FALSE),
('73870','Villahermosa', FALSE),
('73873','Villarrica', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('76001','Cali', TRUE),
('76020','Alcalá', FALSE),
('76036','Andalucía', FALSE),
('76041','Ansermanuevo', FALSE),
('76054','Argelia', FALSE),
('76100','Bolívar', FALSE),
('76109','Buenaventura', FALSE),
('76111','Bugalagrande', FALSE),
('76113','Caicedonia', FALSE),
('76122','Calima', FALSE),
('76126','Candelaria', FALSE),
('76130','Cartago', FALSE),
('76147','Dagua', FALSE),
('76233','El Cerrito', FALSE),
('76243','El Águila', FALSE),
('76246','El Cairo', FALSE),
('76248','El Dovio', FALSE),
('76250','Florida', FALSE),
('76275','Ginebra', FALSE),
('76306','Guacarí', FALSE),
('76318','Jamundí', FALSE),
('76364','La Cumbre', FALSE),
('76377','La Unión', FALSE),
('76400','La Victoria', FALSE),
('76403','Obando', FALSE),
('76497','Palmira', FALSE),
('76520','Pradera', FALSE),
('76563','Restrepo', FALSE),
('76606','Riofrío', FALSE),
('76616','Roldanillo', FALSE),
('76622','San Pedro', FALSE),
('76670','Sevilla', FALSE),
('76736','Toro', FALSE),
('76823','Trujillo', FALSE),
('76828','Tuluá', FALSE),
('76834','Ulloa', FALSE),
('76845','Versalles', FALSE),
('76863','Vijes', FALSE),
('76869','Yotoco', FALSE),
('76890','Yumbo', FALSE),
('76892','Zarzal', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('81001','Arauca', TRUE),
('81065','Arauquita', FALSE),
('81220','Cravo Norte', FALSE),
('81300','Fortul', FALSE),
('81591','Puerto Rondón', FALSE),
('81736','Saravena', FALSE),
('81794','Tame', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('85001','Yopal', TRUE),
('85010','Aguazul', FALSE),
('85015','Chámeza', FALSE),
('85125','Hato Corozal', FALSE),
('85136','La Salina', FALSE),
('85139','Maní', FALSE),
('85162','Monterrey', FALSE),
('85225','Nunchía', FALSE),
('85230','Orocué', FALSE),
('85250','Paz de Ariporo', FALSE),
('85263','Pore', FALSE),
('85279','Recetor', FALSE),
('85300','Sabanalarga', FALSE),
('85315','Sácama', FALSE),
('85325','San Luis de Palenque', FALSE),
('85400','Támara', FALSE),
('85410','Tauramena', FALSE),
('85430','Trinidad', FALSE),
('85440','Villanueva', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('86001','Mocoa', TRUE),
('86019','Colón', FALSE),
('86032','Orito', FALSE),
('86069','Puerto Caicedo', FALSE),
('86079','Puerto Guzmán', FALSE),
('86081','Puerto Leguízamo', FALSE),
('86102','San Francisco', FALSE),
('86162','San Miguel', FALSE),
('86219','Santiago', FALSE),
('86320','Valle del Guamuez', FALSE),
('86568','Villagarzón', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('88001','San Andrés', TRUE),
('88564','Providencia', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('91001','Leticia', TRUE),
('91263','El Encanto', FALSE),
('91405','La Chorrera', FALSE),
('91407','La Pedrera', FALSE),
('91430','La Victoria', FALSE),
('91460','Mirití-Paraná', FALSE),
('91530','Puerto Alegría', FALSE),
('91536','Puerto Arica', FALSE),
('91540','Puerto Nariño', FALSE),
('91669','Puerto Santander', FALSE),
('91798','Tarapacá', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('94001','Inírida', TRUE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('95001','San José del Guaviare', TRUE),
('95015','Calamar', FALSE),
('95025','El Retorno', FALSE),
('95200','Miraflores', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('97001','Mitú', TRUE),
('97161','Carurú', FALSE),
('97511','Pacoa', FALSE),
('97666','Taraira', FALSE),
('97777','Papunaua', FALSE),
('97889','Yavaraté', FALSE);

INSERT INTO tmp_municipios (codigo_dane, nombre, es_capital) VALUES
('99001','Puerto Carreño', TRUE),
('99524','La Primavera', FALSE),
('99624','Santa Rosalía', FALSE),
('99773','Cumaribo', FALSE);


INSERT INTO municipios (
  departamento_id,
  codigo_dane,
  nombre,
  es_capital
)
SELECT
  d.id,
  m.codigo_dane,
  m.nombre,
  m.es_capital
FROM tmp_municipios m
JOIN departamentos d
  ON d.codigo_dane = SUBSTRING(m.codigo_dane FROM 1 FOR 2)
ON CONFLICT (departamento_id, codigo_dane) DO NOTHING;


DROP TABLE IF EXISTS tmp_municipios;
