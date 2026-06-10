import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { SyncService } from "./sync.service";

@Module({
  imports: [ProvidersModule],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
