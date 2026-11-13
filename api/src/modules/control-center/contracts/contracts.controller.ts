import { Body, Controller, Get, Headers, Inject, Param, Post, Query, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { buildControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterAdmin } from "../control-center-admin.decorator";
import { ContractsService } from "./contracts.service";

@Controller("admin/control-center/contracts")
@ControlCenterAdmin()
export class ContractsController {
  constructor(@Inject(ContractsService) private readonly service: ContractsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.service.list(query);
  }

  @Post("preview")
  preview(@Body() body: unknown) {
    return this.service.preview(body);
  }

  @Post()
  create(@Body() body: unknown, @Headers("idempotency-key") idempotencyKey: unknown, @Req() request: any) {
    return this.service.create(body, idempotencyKey, buildControlCenterRequestContext(request));
  }

  @Get(":contractId/pdf")
  async pdf(@Param("contractId") contractId: string, @Query("versionId") versionId: unknown, @Req() request: any, @Res() response: Response) {
    const file = await this.service.pdf(contractId, versionId, buildControlCenterRequestContext(request));
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.send(file.content);
  }

  @Get(":contractId")
  get(@Param("contractId") contractId: string) {
    return this.service.get(contractId);
  }

  @Post(":contractId/activate")
  activate(@Param("contractId") contractId: string, @Body() body: unknown, @Req() request: any) {
    return this.service.activate(contractId, body, buildControlCenterRequestContext(request));
  }

  @Post(":contractId/amend")
  amend(@Param("contractId") contractId: string, @Body() body: unknown, @Req() request: any) {
    return this.service.amend(contractId, body, buildControlCenterRequestContext(request));
  }

  @Post(":contractId/end")
  end(@Param("contractId") contractId: string, @Body() body: unknown, @Req() request: any) {
    return this.service.end(contractId, body, buildControlCenterRequestContext(request));
  }

  @Post(":contractId/void")
  void(@Param("contractId") contractId: string, @Body() body: unknown, @Req() request: any) {
    return this.service.voidContract(contractId, body, buildControlCenterRequestContext(request));
  }

  @Post(":contractId/cancel")
  cancel(@Param("contractId") contractId: string, @Body() body: unknown, @Req() request: any) {
    return this.service.cancel(contractId, body, buildControlCenterRequestContext(request));
  }
}
