import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { buildControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterAdmin } from "../control-center-admin.decorator";
import type { UploadedReceiptFile } from "./receipt-attachments";
import { ReceiptsService } from "./receipts.service";

/** Límite duro de multer; el límite configurable se valida en el servicio. */
const HARD_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;

const contentDispositionName = (name: string) => {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
};

@Controller("admin/control-center")
@ControlCenterAdmin()
export class ReceiptsController {
  constructor(@Inject(ReceiptsService) private readonly service: ReceiptsService) {}

  @Get("payment-methods")
  paymentMethods() {
    return this.service.paymentCatalog();
  }

  @Get("receipts")
  list(@Query() query: Record<string, unknown>) {
    return this.service.list(query);
  }

  @Post("receipts")
  @UseInterceptors(FileInterceptor("attachment", { limits: { fileSize: HARD_UPLOAD_LIMIT_BYTES, files: 1 } }))
  create(
    @Body() body: unknown,
    @UploadedFile() file: UploadedReceiptFile | undefined,
    @Headers("idempotency-key") idempotencyKey: unknown,
    @Req() request: any,
  ) {
    return this.service.create(body, file, idempotencyKey, buildControlCenterRequestContext(request));
  }

  @Get("receipts/:receiptId")
  get(@Param("receiptId") receiptId: string) {
    return this.service.get(receiptId);
  }

  @Get("receipts/:receiptId/attachment")
  async attachment(@Param("receiptId") receiptId: string, @Res() response: Response) {
    const file = await this.service.attachment(receiptId);
    response.setHeader("Content-Type", file.mime);
    response.setHeader("Content-Disposition", contentDispositionName(file.name));
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.send(file.content);
  }

  @Post("receipts/:receiptId/allocations")
  allocate(@Param("receiptId") receiptId: string, @Body() body: unknown, @Req() request: any) {
    return this.service.allocate(receiptId, body, buildControlCenterRequestContext(request));
  }

  @Post("receipts/:receiptId/void")
  void(@Param("receiptId") receiptId: string, @Body() body: unknown, @Req() request: any) {
    return this.service.void(receiptId, body, buildControlCenterRequestContext(request));
  }

  @Post("allocations/:allocationId/reverse")
  reverse(@Param("allocationId") allocationId: string, @Body() body: unknown, @Req() request: any) {
    return this.service.reverseAllocation(allocationId, body, buildControlCenterRequestContext(request));
  }
}
