import { Module } from "@nestjs/common";
import { DatabaseModule } from "../db/database.module";
import { AuditService } from "./audit.service";
import { CacheService } from "./cache.service";

@Module({
  imports: [DatabaseModule],
  providers: [AuditService, CacheService],
  exports: [AuditService, CacheService],
})
export class CommonServicesModule {}
