import { Body, Controller, Inject, Post } from "@nestjs/common";
import { SyncService } from "../sync/sync.service";
import { FiscalLookupService } from "./fiscal-lookup.service";
import type {
  FiscalLookupPreviewRequest,
  FiscalLookupResult,
} from "./fiscal-lookup.types";
import type {
  FiscalLookupSyncRequest,
  FiscalLookupSyncResult,
} from "../sync/sync.types";

@Controller("fiscal-lookup")
export class FiscalLookupController {
  constructor(
    private readonly fiscalLookupService: FiscalLookupService,
    @Inject(SyncService)
    private readonly syncService: SyncService
  ) {}

  @Post("preview")
  preview(
    @Body() body: FiscalLookupPreviewRequest
  ): Promise<FiscalLookupResult> {
    return this.fiscalLookupService.preview(body);
  }

  @Post("sync")
  sync(
    @Body() body: FiscalLookupSyncRequest
  ): Promise<FiscalLookupSyncResult> {
    return this.syncService.syncParty(body);
  }
}
