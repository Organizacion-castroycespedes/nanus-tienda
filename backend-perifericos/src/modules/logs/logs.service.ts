import { Injectable } from "@nestjs/common";
import { getPeripheralsConfig } from "../../shared/config/peripherals.config";
import { createId } from "../../shared/utils/id.util";
import { LogLevel, type PeripheralLog } from "../../shared/types/peripheral.types";

type AppendLogInput = {
  level?: LogLevel;
  source: string;
  event: string;
  message: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class LogsService {
  private logs: PeripheralLog[] = [];
  private readonly maxLogs = getPeripheralsConfig().logLimit;

  append(input: AppendLogInput): PeripheralLog {
    const log: PeripheralLog = {
      id: createId("log"),
      timestamp: new Date().toISOString(),
      level: input.level ?? LogLevel.INFO,
      source: input.source,
      event: input.event,
      message: input.message,
      metadata: input.metadata ?? {},
    };

    this.logs = [log, ...this.logs].slice(0, this.maxLogs);
    return log;
  }

  list(): PeripheralLog[] {
    return [...this.logs];
  }

  getLimit(): number {
    return this.maxLogs;
  }

  clear(): void {
    this.logs = [];
  }
}
