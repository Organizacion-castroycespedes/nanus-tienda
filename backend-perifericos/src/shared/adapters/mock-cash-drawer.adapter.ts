import { createCashDrawerPulseCommands } from "../escpos-mock/thermal-ticket.formatter";
import { ConnectionType, DeviceType } from "../types/peripheral.types";
import type { DeviceProfile } from "../profiles/device-profiles";
import type {
  AdapterCapabilities,
  AdapterResult,
  CashDrawerAdapter,
  CashDrawerAdapterInput,
} from "./peripheral-adapter.types";

export class MockCashDrawerAdapter implements CashDrawerAdapter {
  readonly type = DeviceType.CASH_DRAWER;
  readonly connectionType = ConnectionType.MOCK;
  readonly mode = "MOCK" as const;
  readonly adapterName = "MockCashDrawerAdapter";

  getCapabilities(profile: DeviceProfile): AdapterCapabilities {
    return {
      adapterName: this.adapterName,
      mode: this.mode,
      connectionType: this.connectionType,
      supportsCut: profile.supportsCut,
      supportsPhysicalCut: false,
      supportsCashDrawerPulse: profile.supportsCashDrawerPulse,
    };
  }

  open(input: CashDrawerAdapterInput): AdapterResult {
    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile),
      commands: createCashDrawerPulseCommands(),
      pulse: input.pulse,
    };
  }
}
