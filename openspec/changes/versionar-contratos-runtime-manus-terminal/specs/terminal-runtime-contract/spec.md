## Purpose

Allow independently deployed remote Manus Web to detect installed terminal contract support and safely degrade peripheral operations.

## ADDED Requirements

### Requirement: Minimal runtime metadata
The terminal SHALL expose installed shell version, integer bridge contract generation, nullable observed Agent API generation, and explicit supported capabilities through a fixed typed bridge method without native privileges or transport controls.

#### Scenario: Current Agent responds
- **WHEN** a generation 1 Agent responds to the health probe
- **THEN** runtime metadata reports bridge generation 1, Agent generation 1 and only existing bridge capabilities.

#### Scenario: Agent unknown
- **WHEN** health is unavailable or lacks API generation
- **THEN** Agent generation is null and only the health probe capability is advertised.

### Requirement: Compatibility and operation guards
Web SHALL classify COMPATIBLE, DEGRADED or INCOMPATIBLE and check explicit capabilities and callable methods before invoking fixed peripheral operations.

#### Scenario: Supported runtime
- **WHEN** both generations are supported and requested capabilities have methods
- **THEN** the classification is COMPATIBLE and those operations can run.

#### Scenario: Capability absent
- **WHEN** an advertised capability or its method is absent
- **THEN** that operation returns a controlled unavailable error without a missing-function crash or browser transport fallback.

#### Scenario: Unsupported generation
- **WHEN** metadata has an unsupported generation or invalid shape
- **THEN** classification is INCOMPATIBLE and peripheral operations are blocked.

#### Scenario: Legacy bridge or metadata failure
- **WHEN** metadata is absent, rejects or times out
- **THEN** classification is DEGRADED; only an absent metadata method permits legacy fixed calls whose methods exist, while failed modern negotiation permits none.

### Requirement: Browser and scope preservation
Browser-only and SSR Web SHALL continue without Electron metadata. P9.1 SHALL NOT introduce later roadmap implementations or weaken renderer isolation.

#### Scenario: No bridge
- **WHEN** Web runs without manusTerminal
- **THEN** runtime inspection is safe, terminal capabilities are empty, and existing browser transport remains available.
