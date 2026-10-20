import { BadRequestException, Body, Controller, Get, Headers, Inject, Logger, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ScaleAuthorizationRuntimeService } from "./scale-authorization.runtime.service";
import { logScaleObservationEvent, logScaleObservationFailure } from "./scale-observation-telemetry";

type AuthRequest = Request & { user?: { tenantId?: string; id?: string; roles?: string[] } };

@Controller("scale-authorization")
export class ScaleAuthorizationPairingController {
  private readonly logger = new Logger(ScaleAuthorizationPairingController.name);
  constructor(@Inject(ScaleAuthorizationRuntimeService) private readonly service: ScaleAuthorizationRuntimeService) {}

  @Post("pairing/challenge")
  challenge(@Body() input: { installationId: string; nonce: string; enrollmentPublicKeyPem: string }) {
    return this.service.createPairingChallenge(input);
  }

  @Post("agent/validate")
  async validateAgent(@Headers("authorization") authorization?: string) {
    const result = await this.service.authenticateAgent(authorization);
    return { authenticated: true, tenantId: result.tenantId, terminalDeviceId: result.terminalDeviceId };
  }

  @Post("agent/readiness")
  async readiness(@Headers("authorization") authorization: string | undefined, @Body() input: {
    posTerminalId: string; logicalScaleId: string; source: string; unit: string | null; unitVerified: boolean; observedAt: string;
  }) {
    const auth = await this.service.authenticateAgent(authorization);
    return this.service.deriveReadiness(auth, { ...input, credentialSecret: auth.credentialSecret });
  }

  @Post("agent/weight-captures/observation")
  async captureObservation(@Headers("authorization") authorization: string | undefined, @Body() input: {
    captureId: string; deviceId: string; weight: number; unit: string | null; source: string; unitVerified: boolean; observedAt: string;
  }) {
    const captureId = typeof input?.captureId === "string"
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.captureId)
      ? input.captureId : undefined;
    logScaleObservationEvent(this.logger, "observation.received", captureId, "request_received");
    const allowed = new Set(["captureId", "deviceId", "weight", "unit", "source", "unitVerified", "observedAt"]);
    if (!input || Object.keys(input).some((key) => !allowed.has(key))) {
      const error = new BadRequestException("CAPTURE_OBSERVATION_INVALID");
      logScaleObservationFailure(this.logger, captureId, "request_validation", error);
      throw error;
    }
    let auth: Awaited<ReturnType<ScaleAuthorizationRuntimeService["authenticateAgent"]>>;
    try {
      auth = await this.service.authenticateAgent(authorization);
    } catch (error) {
      logScaleObservationFailure(this.logger, captureId, "agent_authentication", error);
      throw error;
    }
    logScaleObservationEvent(this.logger, "observation.agent_authenticated", captureId, "agent_authenticated");
    return this.service.submitCaptureObservation(auth, input);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermission({ menuKey: MENU_KEYS.POS_PERIPHERALS, level: "WRITE" })
@Controller("scale-authorization/admin")
export class ScaleAuthorizationAdminController {
  constructor(@Inject(ScaleAuthorizationRuntimeService) private readonly service: ScaleAuthorizationRuntimeService) {}

  private actor(request: AuthRequest) {
    return { tenantId: request.user?.tenantId, userId: request.user?.id, roles: request.user?.roles ?? [] };
  }

  @Post("pairing/approve")
  approve(@Body() input: { signedChallenge: unknown; pairingCode: string; posTerminalId: string; logicalScaleId: string; enrollmentPublicKeyPem: string }, @Req() request: AuthRequest) {
    return this.service.approvePairing(input as never, this.actor(request));
  }

  @Post("bindings")
  createBinding(@Body() input: { posTerminalId: string; logicalScaleId: string }, @Req() request: AuthRequest) {
    return this.service.createBinding(input, this.actor(request));
  }

  @Post("bindings/:id/confirm-kg")
  confirmKg(@Param("id") id: string, @Req() request: AuthRequest) {
    const actor = this.actor(request);
    return this.service.confirmKg(actor.tenantId, actor.userId, id);
  }

  @Post("bindings/:id/revoke")
  revokeBinding(@Param("id") id: string, @Req() request: AuthRequest) {
    const actor = this.actor(request);
    return this.service.revokeBinding(actor.tenantId, id, actor.userId);
  }

  @Post("credentials/:credentialId/revoke")
  revokeCredential(@Param("credentialId") credentialId: string, @Req() request: AuthRequest) {
    const actor = this.actor(request);
    return this.service.revokeAgentCredential(actor.tenantId, credentialId, actor.userId);
  }

  @Get("state")
  state(@Query("posTerminalId") id: string, @Req() request: AuthRequest) {
    return this.service.getTerminalState(id, this.actor(request));
  }
}
