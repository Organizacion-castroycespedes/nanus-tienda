## ADDED Requirements

### Requirement: Public Home uses Manus POS landing hero
The public root Home SHALL render a high-impact hero for Manus POS at `/` using the asset `/images/home/manus-pos-hero-landing.png`.

#### Scenario: Root Home hero renders
- **WHEN** a visitor opens `/`
- **THEN** the page shows the headline `Controla ventas, inventario, caja y pedidos desde un solo lugar`
- **AND** the page shows the required subheadline about tiendas, minimarkets and real-time control
- **AND** the page shows the primary CTA `Solicitar demo`
- **AND** the page shows the secondary CTA `Ver funcionalidades`
- **AND** the page renders the hero image from `/images/home/manus-pos-hero-landing.png`

#### Scenario: Hero chips render
- **WHEN** the public Home hero renders
- **THEN** it shows chips for `POS`, `Inventario`, `Caja`, `Pedidos`, and `Reportes`

### Requirement: Public Home presents real product capabilities
The public Home SHALL present the real Manus POS capability set without claiming out-of-scope modules.

#### Scenario: Feature cards render
- **WHEN** a visitor reaches the features section
- **THEN** the page shows feature cards for Punto de venta, Inventario, Caja y finanzas, Pedidos, Compras, Clientes, Reportes, and Configuracion
- **AND** the content describes operational value for stores, minimarkets and small businesses
- **AND** each card renders its matching public image from `/images/features/`
- **AND** the Caja y finanzas card uses `/images/features/caja-finanzas.png`
- **AND** the Punto de venta card uses `/images/features/punto_ventas.png`

#### Scenario: Feature showcase renders
- **WHEN** a visitor reaches the showcase section
- **THEN** the page shows visual blocks for POS, Inventario, Caja, Pedidos / clientes, and Reportes
- **AND** the content is commercial and based on actual system modules

### Requirement: Public Home explains benefits and workflow
The public Home SHALL explain the benefits and basic operating workflow for a store or minimarket.

#### Scenario: Benefits render
- **WHEN** a visitor reaches the benefits section
- **THEN** the page shows benefits for Mas control, Menos errores, Operacion mas rapida, Informacion en tiempo real, and Acceso desde cualquier lugar
- **AND** each benefit card renders its matching public image from `/images/benefits/`
- **AND** the Menos errores card uses `/images/benefits/menos-errores.png`
- **AND** the benefit cards do not rely on icon-only visuals

#### Scenario: Workflow renders
- **WHEN** a visitor reaches the how-it-works section
- **THEN** the page shows the eyebrow Como funciona
- **AND** the page shows the title Del producto en estanteria al reporte de ventas
- **AND** the page renders `/images/home/flows/flujo-operacion-pos.png` as the primary workflow visual
- **AND** the step cards do not compete visually with the workflow image
- **AND** the image remains contained on desktop and horizontally scrollable on narrow mobile screens if needed

### Requirement: Public Home identifies target audiences
The public Home SHALL identify the business types Manus POS serves using modern visual cards.

#### Scenario: Target audience cards render
- **WHEN** a visitor reaches the target audience section
- **THEN** the page shows cards for Tiendas de barrio, Minimarkets, Retail pequeno, and Negocios con inventario
- **AND** each card renders its matching public image from `/images/audience/`
- **AND** Tiendas de barrio uses `/images/audience/tiendas-barrio.png`
- **AND** Minimarkets uses `/images/audience/minimarkets.png`
- **AND** Retail pequeno uses `/images/audience/retail-pequeno.png`
- **AND** Negocios con inventario uses `/images/audience/negocios-inventario.png`
- **AND** the cards do not rely on icon-only visuals

### Requirement: Public Home stays isolated from internal app routes
The public Home redesign SHALL NOT modify internal tenant dashboard behavior or protected system routes.

#### Scenario: Internal dashboard remains untouched
- **WHEN** the change is reviewed
- **THEN** no files under `web/app/[tenant]/dashboard/` are modified
- **AND** no files under `web/components/home/` are modified

#### Scenario: Runtime boundaries remain unchanged
- **WHEN** the change is reviewed
- **THEN** backend, SQL, permissions, guards, API contracts, Electron, Capacitor, peripherals, electronic invoicing and CRM behavior remain unchanged

### Requirement: Public Home is responsive
The public Home SHALL remain usable on desktop, tablet and mobile widths.

#### Scenario: Mobile layout remains readable
- **WHEN** the Home is viewed on a mobile viewport
- **THEN** hero copy, CTAs, chips, cards and final CTA remain visible without text overlap

#### Scenario: Desktop layout remains polished
- **WHEN** the Home is viewed on a desktop viewport
- **THEN** sections use balanced spacing, clear visual hierarchy and stable card layouts
