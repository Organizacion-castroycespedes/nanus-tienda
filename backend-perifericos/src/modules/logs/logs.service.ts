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
  private readonly config = getPeripheralsConfig();
  private readonly maxLogs = this.config.logLimit;

  append(input: AppendLogInput): PeripheralLog {
    const level = input.level ?? LogLevel.INFO;
    if (!this.shouldStore(level)) {
      return {
        id: createId("log"),
        timestamp: new Date().toISOString(),
        level,
        source: input.source,
        event: input.event,
        message: input.message,
        metadata: input.metadata ?? {},
      };
    }

    const log: PeripheralLog = {
      id: createId("log"),
      timestamp: new Date().toISOString(),
      level,
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

  private shouldStore(level: LogLevel): boolean {
    const thresholds: Record<LogLevel, number> = {
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 1,
      [LogLevel.ERROR]: 2,
    };
    return thresholds[level] >= thresholds[this.config.logLevel];
  }
}
