## ADDED Requirements

### Requirement: POS peripheral strategy documentation

The Electron Windows client SHALL document a future strategy for POS peripheral integrations without implementing hardware access in this phase.

#### Scenario: Thermal receipt printing options are documented

- **WHEN** the strategy is reviewed
- **THEN** it SHALL document thermal receipt printing options for Windows and Electron

#### Scenario: Cash drawer opening options are documented

- **WHEN** the strategy is reviewed
- **THEN** it SHALL document cash drawer opening options and controls

#### Scenario: Barcode scanner options are documented

- **WHEN** the strategy is reviewed
- **THEN** it SHALL document barcode scanner options including keyboard HID mode

#### Scenario: Scale integration options are documented

- **WHEN** the strategy is reviewed
- **THEN** it SHALL document scale integration options and risks

#### Scenario: Fiscal printer constraints are documented

- **WHEN** the strategy is reviewed
- **THEN** it SHALL document fiscal printer constraints as future and regulatory scope

### Requirement: Electron hardware boundary

The Electron Windows client SHALL define a secure boundary for future hardware access.

#### Scenario: Hardware access is assigned to Electron layers

- **WHEN** future hardware access is designed
- **THEN** it SHALL be assigned to Electron main/preload layers or a controlled local agent, not unrestricted web renderer code

#### Scenario: Renderer access is limited to explicit preload APIs

- **WHEN** renderer code requests future hardware actions
- **THEN** access SHALL be limited to explicit preload APIs

#### Scenario: Node integration remains disabled

- **WHEN** hardware strategy is defined
- **THEN** Node integration SHALL remain disabled for the renderer

#### Scenario: Context isolation remains enabled

- **WHEN** hardware strategy is defined
- **THEN** context isolation SHALL remain enabled

#### Scenario: Arbitrary command execution is out of scope

- **WHEN** future hardware access is considered
- **THEN** arbitrary command execution from renderer code SHALL remain out of scope

### Requirement: Online business authority preserved

The peripheral strategy SHALL preserve backend/API authority for business operations.

#### Scenario: Hardware effects do not create sales

- **WHEN** a hardware effect is triggered in a future phase
- **THEN** it SHALL NOT create sales by itself

#### Scenario: Hardware effects do not open or close cash sessions

- **WHEN** a hardware effect is triggered in a future phase
- **THEN** it SHALL NOT open or close cash sessions by itself

#### Scenario: Hardware effects do not alter invoicing rules

- **WHEN** a hardware effect is triggered in a future phase
- **THEN** it SHALL NOT alter invoicing rules by itself

#### Scenario: Operational logic remains unchanged in this phase

- **WHEN** this analysis phase is complete
- **THEN** POS, cash, order, and invoicing logic SHALL remain unchanged

### Requirement: No hardware implementation in analysis phase

The Electron Windows client SHALL not integrate real POS hardware in this phase.

#### Scenario: No ESC/POS command implementation is added

- **WHEN** this analysis phase is complete
- **THEN** no ESC/POS command implementation SHALL be added

#### Scenario: No serial or USB access implementation is added

- **WHEN** this analysis phase is complete
- **THEN** no serial or USB access implementation SHALL be added

#### Scenario: No printer SDK is installed

- **WHEN** this analysis phase is complete
- **THEN** no printer SDK SHALL be installed

#### Scenario: No fiscal printer SDK is installed

- **WHEN** this analysis phase is complete
- **THEN** no fiscal printer SDK SHALL be installed

#### Scenario: No peripheral runtime QA is marked PASS

- **WHEN** QA evidence is recorded
- **THEN** real peripheral runtime QA SHALL NOT be marked PASS
