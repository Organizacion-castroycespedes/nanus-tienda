import { BadRequestException } from "@nestjs/common";
import { ConnectionType, DeviceType, type PeripheralDevice } from "../types/peripheral.types";
import { getPeripheralsConfig } from "../config/peripherals.config";
import type { PeripheralsMode } from "../config/peripherals.config";
import { getDeviceProfile, type DeviceProfile } from "../profiles/device-profiles";
import { MockCashDrawerAdapter } from "./mock-cash-drawer.adapter";
import { MockPrinterAdapter } from "./mock-printer.adapter";
import { NetworkEscposPrinterAdapter } from "./network-escpos-printer.adapter";
import { UsbSystemPrinterAdapter } from "./usb-system-printer.adapter";
import type { CashDrawerAdapter, PrinterAdapter } from "./peripheral-adapter.types";

export const REAL_ADAPTERS_DISABLED_MESSAGE =
  "Real peripheral adapters are disabled. Enable PERIPHERALS_ENABLE_REAL_ADAPTERS=true to use them.";

export class PeripheralAdapterResolver {
  private readonly mockPrinterAdapter = new MockPrinterAdapter();
  private readonly mockCashDrawerAdapter = new MockCashDrawerAdapter();
  private readonly networkEscposPrinterAdapter = new NetworkEscposPrinterAdapter();
  private readonly usbSystemPrinterAdapter = new UsbSystemPrinterAdapter();

  constructor(
    private readonly realAdaptersEnabled =
      getPeripheralsConfig().realAdaptersEnabled
  ) {}

  resolveProfile(device: PeripheralDevice): DeviceProfile {
    return getDeviceProfile(device.profileId);
  }

  resolvePrinter(device: PeripheralDevice, mode: PeripheralsMode): PrinterAdapter {
    if (device.type !== DeviceType.PRINTER) {
      throw new BadRequestException("device must be PRINTER");
    }

    if (mode === "MOCK" && device.connectionType === ConnectionType.MOCK) {
      return this.mockPrinterAdapter;
    }

    this.assertRealAdaptersEnabled(device.connectionType);

    if (device.connectionType === ConnectionType.NETWORK) {
      return this.networkEscposPrinterAdapter;
    }

    if (device.connectionType === ConnectionType.USB) {
      return this.usbSystemPrinterAdapter;
    }

    throw new BadRequestException(
      `Adapter for connection type ${device.connectionType} is not implemented yet.`
    );
  }

  resolveCashDrawer(
    device: PeripheralDevice,
    mode: PeripheralsMode
  ): CashDrawerAdapter | PrinterAdapter {
    if (device.type === DeviceType.PRINTER) {
      return this.resolvePrinter(device, mode);
    }

    if (device.type !== DeviceType.CASH_DRAWER) {
      throw new BadRequestException("device must be CASH_DRAWER");
    }

    if (mode === "MOCK" && device.connectionType === ConnectionType.MOCK) {
      return this.mockCashDrawerAdapter;
    }

    this.assertRealAdaptersEnabled(device.connectionType);

    throw new BadRequestException(
      `Adapter for connection type ${device.connectionType} is not implemented yet.`
    );
  }

  private assertRealAdaptersEnabled(connectionType: ConnectionType): void {
    if (
      !this.realAdaptersEnabled &&
      connectionType !== ConnectionType.MOCK
    ) {
      throw new BadRequestException(REAL_ADAPTERS_DISABLED_MESSAGE);
    }
  }
}
