## ADDED Requirements

### Requirement: Calendar periods use the effective business timezone
The reporting system SHALL interpret date-only filters as calendar dates in the effective business timezone and SHALL query PostgreSQL with a start-inclusive, end-exclusive `timestamptz` interval.

#### Scenario: Current day without explicit dates
- **WHEN** an authorized user opens a scoped report without `dateFrom` or `dateTo`
- **THEN** the effective period starts at `00:00:00` of the current business date and ends at the current instant in the effective timezone

#### Scenario: Historical single day
- **WHEN** an authorized user requests one date
- **THEN** the interval includes every instant from that date's local midnight through the instant before the next local midnight, preserving subsecond precision

#### Scenario: Inclusive date range
- **WHEN** an authorized user requests `dateFrom` and `dateTo`
- **THEN** the start is inclusive at the first date's local midnight and the end is exclusive at the next local midnight after `dateTo`, except that a range including today ends at the current instant

#### Scenario: Bogotá UTC conversion
- **WHEN** a date-only filter is resolved for `America/Bogota`
- **THEN** local midnight is converted once to its corresponding UTC `timestamptz` boundary and is not interpreted as `00:00:00Z`

### Requirement: Reports enforce the three-month calendar window
The reporting system SHALL accept only dates from the dynamically calculated date three calendar months before today through today, SHALL reject future dates and inverted ranges, and SHALL prevent invalid requests from executing report SQL.

#### Scenario: Exact lower boundary
- **WHEN** the requested start equals the calculated three-month calendar boundary
- **THEN** the request is accepted

#### Scenario: Month-end subtraction
- **WHEN** today is a month-end or the target month has fewer days
- **THEN** the minimum date uses the last valid calendar day of the target month

#### Scenario: Invalid range
- **WHEN** the start is after the end or either date is future
- **THEN** the backend returns the existing validation error mechanism and executes no report query

#### Scenario: Frontend date picker validation
- **WHEN** a selected date is outside the allowed window
- **THEN** the selector disables or rejects it and shows `Solo puedes consultar información de los últimos 3 meses. Modifica las fechas seleccionadas para continuar`

### Requirement: Effective period metadata is visible
The report response and generated documents SHALL identify the effective start, effective end or current cut-off, effective timezone, and generation timestamp.

#### Scenario: Screen metadata
- **WHEN** a report is loaded successfully
- **THEN** the screen shows the queried period with date, time and timezone plus the generation time

#### Scenario: Export metadata
- **WHEN** PDF or Excel is generated
- **THEN** its summary includes the same effective period, timezone and generation timestamp used by the dataset
