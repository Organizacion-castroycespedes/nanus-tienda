## ADDED Requirements

### Requirement: Digital POS DIG-E200I network printer configuration

El sistema SHALL permitir representar la impresora Digital POS DIG-E200I como una impresora POS de red configurable.

#### Scenario: Configure DIG-E200I LAN

- GIVEN una terminal con PeripheralAgent
- WHEN el administrador registra la impresora Digital POS DIG-E200I por LAN
- THEN el sistema SHALL permitir definir `name`, `manufacturer`, `model`, `connectionType`, `host`, `port` y `enabled`
- AND SHALL keep the host configurable without hardcoding the observed lab IP.

#### Scenario: Port default is configurable

- GIVEN una DIG-E200I de red
- WHEN el usuario omite el puerto explicitamente
- THEN el sistema SHALL allow `9100` as a convenient default
- AND SHALL still allow a different port without code changes.

### Requirement: TCP RAW printing through PeripheralAgent

El sistema SHALL enviar la impresion de DIG-E200I a traves de PeripheralAgent usando TCP RAW.

#### Scenario: Print over TCP

- GIVEN una DIG-E200I configurada y accesible
- WHEN Manus solicita una impresion de prueba o un ticket
- THEN PeripheralAgent SHALL transmit the payload through the configured network transport
- AND SHALL NOT require the browser to open a socket directly to the printer.

#### Scenario: Printer unreachable returns controlled error

- GIVEN una DIG-E200I configurada
- AND the printer is powered off or unreachable
- WHEN a print job is requested
- THEN PeripheralAgent SHALL return a controlled error
- AND SHALL not block the process waiting indefinitely.

### Requirement: DHCP reconfiguration is supported

El sistema SHALL soportar el cambio de IP causado por DHCP sin cambios de codigo.

#### Scenario: IP changes after DHCP renewal

- GIVEN a DIG-E200I configured by host and port
- WHEN the printer receives a different DHCP address
- THEN the configuration SHALL be updateable by changing the host value only
- AND SHALL not require a new driver, a migration or a code change.

### Requirement: ESC/POS capabilities remain unconfirmed until QA physical

El sistema SHALL distinguish confirmed transport support from unverified print capabilities.

#### Scenario: Unverified capabilities stay pending

- GIVEN the DIG-E200I network transport is working
- WHEN the system evaluates init, cut, drawer, QR, barcode, images, logo or encoding
- THEN the system SHALL keep those capabilities as pending until physical QA confirms them
- AND SHALL not mark them as confirmed only by model name or port number.

#### Scenario: Query port 4000 is documented but not used

- GIVEN the printer exposes a diagnostic query port observed as `4000`
- WHEN no trusted protocol is known
- THEN the system SHALL document the port as a future validation point
- AND SHALL not send arbitrary commands to that port.

### Requirement: Web and Electron reuse PeripheralAgent

El sistema SHALL keep Manus Web and Electron behind PeripheralAgent for DIG-E200I printing.

#### Scenario: Web does not connect directly to the printer

- GIVEN Manus POS Web requests a print
- WHEN DIG-E200I is selected
- THEN the browser SHALL call PeripheralAgent
- AND SHALL NOT connect directly to the printer socket.

#### Scenario: Electron reuses the same peripheral path

- GIVEN Manus POS Electron requests a print
- WHEN DIG-E200I is selected
- THEN Electron SHALL reuse the same PeripheralAgent contract
- AND SHALL not duplicate a separate printer driver stack for this model.
