import { Module } from "@nestjs/common";
import { AgentSecurityController } from "./agent-security.controller";
import { AgentPairingService } from "./agent-pairing.service";
import { LogsModule } from "../logs/logs.module";

@Module({ imports: [LogsModule], controllers: [AgentSecurityController], providers: [AgentPairingService], exports: [AgentPairingService] })
export class AgentSecurityModule {}
