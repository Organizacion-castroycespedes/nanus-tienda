## ADDED Requirements

### Requirement: Current ownership is separate from historical associations
The governance manifest MUST preserve `changes[].paths` as historical associations and MUST support a versioned `current_ownership` collection for the current diff.

#### Scenario: Historical overlap with one current owner
- **WHEN** a changed file matches multiple historical HUs and exactly one `current_ownership` entry
- **THEN** the evaluator reports `CURRENT_SINGLE_MATCH`, the current owner, and the historical change IDs without reporting `MULTIPLE_MATCH`

#### Scenario: No current owner keeps legacy strict behavior
- **WHEN** a changed technical file has no current owner and matches multiple historical HUs
- **THEN** the evaluator reports `MULTIPLE_MATCH` and the strict gate blocks

### Requirement: Current ownership is deterministic and valid
Each current ownership entry MUST have a valid existing change ID, at least one valid path pattern, and a non-empty audit reason. A changed file MUST NOT resolve to more than one current owner.

#### Scenario: Duplicate current owners
- **WHEN** two current ownership entries match the same changed file
- **THEN** the evaluator reports `AMBIGUOUS_CURRENT_OWNERSHIP` and the strict gate rejects

#### Scenario: Invalid current owner
- **WHEN** a current ownership entry references a missing or invalid OpenSpec change
- **THEN** the evaluator reports an invalid association and the strict gate rejects

### Requirement: Current ownership cannot hide uncovered technical files
The evaluator MUST keep zero-match technical files, invalid patterns, invalid exemptions, and contradictory manifest data as blocking findings.

#### Scenario: Technical file has no historical or current coverage
- **WHEN** a changed technical file matches no valid current owner and no historical association
- **THEN** the evaluator reports `ZERO_MATCH` and the strict gate rejects
