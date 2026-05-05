import { Module } from "@nestjs/common";
import { DatabaseService } from "./database.service";
import { FunctionRunnerService } from "./function-runner.service";

@Module({
  providers: [DatabaseService, FunctionRunnerService],
  exports: [DatabaseService, FunctionRunnerService],
})
export class DatabaseModule {}
