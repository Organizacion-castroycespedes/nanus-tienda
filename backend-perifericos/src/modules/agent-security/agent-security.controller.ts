import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { AgentPairingService } from "./agent-pairing.service";

@Controller("agent-security")
export class AgentSecurityController {
  constructor(@Inject(AgentPairingService) private readonly pairing: AgentPairingService) {}

  @Get("status") status() { return this.pairing.status(); }
  @Post("pairing/start") startPairing() { return this.pairing.startPairing(); }
  @Post("pairing/envelope") acceptEnvelope(@Body() envelope: Parameters<AgentPairingService["acceptEnvelope"]>[0]) {
    return this.pairing.acceptEnvelope(envelope);
  }
}
