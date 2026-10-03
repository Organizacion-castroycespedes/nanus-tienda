## ADDED Requirements

### Requirement: Products without standard identification adopt their SKU
The migration SHALL set `dian_standard_item_scheme_id` to `999` and `dian_standard_item_code` to the trimmed SKU for every product whose scheme and code are both NULL and whose SKU is non-empty and not UUID-like.

#### Scenario: Liquor without identification
- **WHEN** product `Whiksy Buchanan´s 12 Años 750ml` has SKU `WHIKSY001` and no standard identification
- **THEN** the migration SHALL set scheme `999` and code `WHIKSY001`

#### Scenario: Existing identification is kept
- **WHEN** a product has scheme `010` and code `080432402795`
- **THEN** the migration SHALL leave scheme and code unchanged

#### Scenario: Re-run is a no-op
- **WHEN** the migration runs a second time
- **THEN** it SHALL update zero rows
