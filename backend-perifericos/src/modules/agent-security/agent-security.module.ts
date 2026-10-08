import { Module } from "@nestjs/common";
import { AgentSecurityController } from "./agent-security.controller";
import { AgentPairingService } from "./agent-pairing.service";

@Module({ controllers: [AgentSecurityController], providers: [AgentPairingService], exports: [AgentPairingService] })
export class AgentSecurityModule {}
