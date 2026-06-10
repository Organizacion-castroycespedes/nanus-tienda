import { Module } from "@nestjs/common";
import { CashDrawerModule } from "./modules/cash-drawer/cash-drawer.module";
import { DevicesModule } from "./modules/devices/devices.module";
import { EventsModule } from "./modules/events/events.module";
import { HealthModule } from "./modules/health/health.module";
import { LogsModule } from "./modules/logs/logs.module";
import { PrinterModule } from "./modules/printer/printer.module";
import { ScaleModule } from "./modules/scale/scale.module";
import { ScannerModule } from "./modules/scanner/scanner.module";

@Module({
  imports: [
    EventsModule,
    LogsModule,
    HealthModule,
    DevicesModule,
    PrinterModule,
    CashDrawerModule,
    ScaleModule,
    ScannerModule,
  ],
})
export class AppModule {}
