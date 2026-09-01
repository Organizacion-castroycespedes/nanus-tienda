"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const dotenv_1 = require("dotenv");
const app_module_1 = require("./app.module");
const peripherals_config_1 = require("./shared/config/peripherals.config");
const sanitized_http_exception_filter_1 = require("./shared/filters/sanitized-http-exception.filter");
const events_service_1 = require("./modules/events/events.service");
const logs_service_1 = require("./modules/logs/logs.service");
const devices_service_1 = require("./modules/devices/devices.service");
const agent_local_config_1 = require("./platform/agent-local-config");
(0, dotenv_1.config)();
(0, agent_local_config_1.loadAgentLocalConfig)();
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = (0, peripherals_config_1.getPeripheralsConfig)();
    app.useGlobalFilters(new sanitized_http_exception_filter_1.SanitizedHttpExceptionFilter());
    const corsOptions = (0, peripherals_config_1.buildPeripheralsCorsOptions)(config.allowedOrigins);
    app.enableCors(corsOptions);
    app.use((request, response, next) => {
        if (request.method !== "OPTIONS") {
            next();
            return;
        }
        const origin = Array.isArray(request.headers.origin)
            ? request.headers.origin[0]
            : request.headers.origin;
        const allowedOrigin = (0, peripherals_config_1.getCorsAllowedOrigin)(origin, config.allowedOrigins);
        if (typeof allowedOrigin !== "string") {
            next();
            return;
        }
        response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", String(request.headers["access-control-request-headers"] ??
            "Content-Type, Authorization, Accept, Origin"));
        response.setHeader("Vary", "Origin");
        response.status(204).send();
    });
    const eventsService = app.get(events_service_1.EventsService);
    const logsService = app.get(logs_service_1.LogsService);
    eventsService.attach(app.getHttpServer(), config.allowedOrigins);
    logsService.append({
        source: "agent",
        event: "agent.starting",
        message: "Peripheral Agent starting",
        metadata: {
            platform: process.platform,
            architecture: process.arch,
            version: config.version,
        },
    });
    await app.listen(config.port, config.bind);
    console.log(`${config.agentName} running in ${config.mode} mode on http://${config.bind}:${config.port}`);
    if (config.realAdaptersEnabled) {
        const devicesService = app.get(devices_service_1.DevicesService);
        setImmediate(() => {
            devicesService.discoverOnStartup();
        });
    }
    let stopping = false;
    const shutdown = async (signal) => {
        if (stopping) {
            return;
        }
        stopping = true;
        console.log(`${config.agentName} stopping after ${signal}.`);
        logsService.append({
            source: "agent",
            event: "shutdown.clean",
            message: "Peripheral Agent shutting down cleanly",
            metadata: { signal },
        });
        await app.close();
        process.exit(0);
    };
    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
}
void bootstrap();
//# sourceMappingURL=main.js.map