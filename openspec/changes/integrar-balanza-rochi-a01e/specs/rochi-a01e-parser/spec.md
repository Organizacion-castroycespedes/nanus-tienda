# ROCHI RC-A01E parser

## ADDED Requirements

### Requirement: parse valid frames
The parser SHALL accept exactly three decimal digits, a period, three decimal digits, and the `CR LF` delimiter.

#### Scenario: captured frames
- **WHEN** the input contains `000.000`, `000.245`, `000.270`, or `000.490` followed by `CR LF`
- **THEN** the parser emits the numeric value and the explicitly configured source unit

### Requirement: handle stream boundaries
The parser SHALL preserve incomplete fragments and emit every complete frame in concatenated input.

#### Scenario: fragmented frame
- **WHEN** `000.245` and `CR LF` arrive in separate chunks
- **THEN** one reading is emitted only after the delimiter arrives

### Requirement: reject corrupt input
The parser SHALL reject malformed frames, non-ASCII input, and overlong incomplete fragments, then recover for later valid frames.

#### Scenario: corruption recovery
- **WHEN** `bad` followed by `CR LF` arrives before a valid `000.270` frame
- **THEN** the parser reports the invalid frame and still emits `000.270`

#### Scenario: buffer protection
- **WHEN** an incomplete fragment exceeds the configured buffer limit
- **THEN** the parser reports overflow, clears the fragment, and accepts the next valid frame

### Requirement: explicit unit conversion
The parser SHALL require `KG` or `LB` configuration and SHALL never infer a unit from the frame. For this ROCHI protocol only, configured `LB` SHALL convert to kilograms with factor `0.5`.

#### Scenario: explicit LB conversion
- **WHEN** source unit is configured as `LB` and the frame is `000.490`
- **THEN** the parser emits `0.245` kilograms and identifies the source unit as `LB`

#### Scenario: no silent unit inference
- **WHEN** the frame is `000.490` and source unit is configured as `KG`
- **THEN** the parser emits `0.490` kilograms and does not change the configured unit

### Requirement: no stability inference
The parser SHALL NOT claim metrological stability from repeated readings because the observed frame has no stability flag.

#### Scenario: repeated values are not stability evidence
- **WHEN** the same valid frame arrives repeatedly
- **THEN** the parser emits readings without a stability claim

### Requirement: configurable serial transport
The ROCHI scale adapter SHALL open only an explicitly configured path with defaults of 9600 baud, 8 data bits, no parity, 1 stop bit, and no flow control.

#### Scenario: safe serial defaults
- **WHEN** the adapter is opened with only a path and explicit source unit
- **THEN** it passes `9600`, `8`, `none`, `1`, and `rtscts=false` to the port factory

### Requirement: controlled lifecycle
The adapter SHALL avoid duplicate opens, expose controlled close/reconnect, report open errors and disconnects, and release the port reference after closure.

#### Scenario: occupied port
- **WHEN** the port reports an open error
- **THEN** the adapter enters `ERROR` and does not expose a reading as fresh

#### Scenario: reconnect
- **WHEN** the caller explicitly requests reconnect after disconnect
- **THEN** the adapter closes the previous port and opens one new port

### Requirement: immediate invalidation on transport loss
The adapter SHALL invalidate the latest reading, parser state, initial synchronization buffer, and pending fragment when `close()` completes, a physical `close` event arrives, or a transport error occurs.

#### Scenario: disconnect invalidates a fresh reading
- **WHEN** a fresh reading exists and the port emits `close`
- **THEN** the status is `DISCONNECTED`, `reading` is absent, `stale` is true, and no parser fragment remains

#### Scenario: transport error invalidates a fresh reading
- **WHEN** a fresh reading exists and the port emits an error
- **THEN** the status is `ERROR`, `reading` is absent, `stale` is true, and no parser fragment remains

#### Scenario: late events cannot restore state
- **WHEN** an old port emits data after disconnect and explicit reconnect
- **THEN** the old data is ignored and only a new port can produce a reading

### Requirement: bounded interactive authorization
The local disconnect runner SHALL apply a real timeout to every authorization pause and a global maximum duration. Timeout, cancellation, EOF, invalid confirmation, and late input SHALL stop the run without advancing to the next stage and SHALL execute cleanup exactly once.

#### Scenario: authorization timeout
- **WHEN** no `YES` arrives before the phase timeout
- **THEN** the runner reports `TIMEOUT`, rejects later input, and does not advance

#### Scenario: global duration timeout
- **WHEN** the global QA budget expires during a pause or wait
- **THEN** the runner reports `TIMEOUT` and closes the adapter

#### Scenario: cancellation or EOF
- **WHEN** Ctrl+C or EOF occurs during authorization
- **THEN** the runner reports cancellation or EOF, closes the prompt, and closes the adapter once

### Requirement: bounded QA duration
The local disconnect runner SHALL cap each authorization pause at 10 seconds and SHALL cap the complete session at 60 seconds. Remaining global time SHALL bound every later pause and wait.

#### Scenario: remaining budget bounds recovery
- **WHEN** earlier QA stages consume part of the global budget
- **THEN** the recovery confirmation and post-reconnect wait cannot exceed the remaining budget

### Requirement: controlled physical disconnect runner
The local disconnect runner SHALL require an exact configured PnP ID, explicit operator confirmations, bounded capture and wait durations, one explicit reconnect, and final cleanup without remote interfaces or POS access.

#### Scenario: device identity changes
- **WHEN** the expected PnP ID is absent or a different identity is detected after reconnect
- **THEN** the runner stops without opening the replacement device

#### Scenario: interrupted session
- **WHEN** the operator sends Ctrl+C during any interactive phase
- **THEN** the runner attempts to close the adapter and exits without automatic reconnect

#### Scenario: recovery requires a separate authorization
- **WHEN** the physical reconnect is confirmed and the same CH340 PnP ID is re-enumerated
- **THEN** the runner asks for a separate `RECOVERY` confirmation before reconnecting or reopening

#### Scenario: recovery identity mismatch
- **WHEN** re-enumeration returns a different PnP identity
- **THEN** the runner stops before recovery and does not open the replacement device

### Requirement: freshness and source labeling
The adapter SHALL mark each reading as `REAL` or `SIMULATED` and SHALL not return a reading older than the configured maximum age.

#### Scenario: stale reading
- **WHEN** no new bytes arrive before `maxReadingAgeMs`
- **THEN** the snapshot is stale and contains no usable reading

### Requirement: isolated simulation
The simulator SHALL implement the same injected port contract and SHALL support arbitrary byte chunks, repeated captures, errors, and disconnects without opening hardware.

#### Scenario: simulated stream
- **WHEN** the simulator emits fragmented and concatenated documented frames
- **THEN** the same parser and unit conversion produce labeled `SIMULATED` readings

### Requirement: initial stream synchronization
The serial transport SHALL synchronize only its first candidate on `CR LF`, preserving a valid first frame and discarding only an invalid startup candidate; after synchronization it SHALL report invalid frames strictly.

#### Scenario: startup suffix
- **WHEN** the first bytes are `45 CR LF` followed by `000.245 CR LF`
- **THEN** the startup suffix is discarded, `000.245` is emitted, and no parser error is reported for the startup suffix

#### Scenario: invalid frame after synchronization
- **WHEN** a valid first frame is followed by `bad CR LF`
- **THEN** the valid frame is emitted and `INVALID_FRAME` is reported

#### Scenario: valid first frame
- **WHEN** the first bytes are `000.245 CR LF`
- **THEN** the first reading is preserved

### Requirement: Windows CH340 discovery and persistent configuration
The Peripheral Agent SHALL discover a connected ROCHI candidate through CH340 `VID_1A86/PID_7523`, preserve its Windows friendly name and PnP identity, and persist an explicit `SCALE/SERIAL/ROCHI_A01E` configuration using `9600/8/N/1` with no flow control.

#### Scenario: COM changes after reconnect
- **WHEN** Windows re-enumerates the same PnP device on another COM port
- **THEN** reconciliation updates the port without creating a duplicate configured device

### Requirement: conservative REAL scale response
The scale endpoint SHALL return physical readings with `source=REAL` and SHALL not infer unit or stability.

#### Scenario: reading before operator unit confirmation
- **WHEN** ROCHI produces a valid physical frame before KG confirmation
- **THEN** the response has `unit=null`, `stable=null`, `unitVerified=false`, and `stabilityVerified=false`

### Requirement: explicit KG operator confirmation
The installer UI SHALL persist KG only after an explicit operator confirmation following a successful REAL read.

#### Scenario: confirmation is absent
- **WHEN** the operator has not confirmed that the display is in KG
- **THEN** the installer and Agent SHALL keep the unit unverified

### Requirement: POS commercial capture remains fail-closed
The POS SHALL keep normal UNIT sales available while preventing WEIGHT and the weight path of BOTH from invoking or applying a scale reading until a later commercial authorization implementation exists.

#### Scenario: weighted action without commercial authorization
- **WHEN** the operator selects a WEIGHT product or the Peso option for a BOTH product
- **THEN** POS reports that REAL capture is unavailable and does not add a weighted quantity
