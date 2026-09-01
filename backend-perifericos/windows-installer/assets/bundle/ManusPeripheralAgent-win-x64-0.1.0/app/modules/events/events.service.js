"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const peripherals_config_1 = require("../../shared/config/peripherals.config");
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
let EventsService = class EventsService {
    clients = new Set();
    recentEvents = [];
    attached = false;
    attach(server, allowedOrigins) {
        if (this.attached) {
            return;
        }
        server.on("upgrade", (request, socket) => {
            if (!this.shouldAccept(request, allowedOrigins)) {
                this.safeWrite(socket, "HTTP/1.1 403 Forbidden\r\n\r\n");
                socket.destroy();
                return;
            }
            const key = request.headers["sec-websocket-key"];
            if (typeof key !== "string") {
                this.safeWrite(socket, "HTTP/1.1 400 Bad Request\r\n\r\n");
                socket.destroy();
                return;
            }
            const accept = (0, node_crypto_1.createHash)("sha1")
                .update(`${key}${WS_GUID}`)
                .digest("base64");
            this.safeWrite(socket, [
                "HTTP/1.1 101 Switching Protocols",
                "Upgrade: websocket",
                "Connection: Upgrade",
                `Sec-WebSocket-Accept: ${accept}`,
                "",
                "",
            ].join("\r\n"));
            this.clients.add(socket);
            socket.on("data", (buffer) => this.handleClientData(socket, buffer));
            socket.on("close", () => this.clients.delete(socket));
            socket.on("error", () => this.clients.delete(socket));
        });
        this.attached = true;
    }
    emit(event, data) {
        const message = { event, data };
        this.recentEvents = [message, ...this.recentEvents].slice(0, 100);
        const frame = this.encodeTextFrame(JSON.stringify(message));
        for (const client of this.clients) {
            if (client.destroyed) {
                this.clients.delete(client);
                continue;
            }
            this.safeWrite(client, frame);
        }
    }
    getRecentEvents() {
        return [...this.recentEvents];
    }
    onApplicationShutdown() {
        for (const client of this.clients) {
            client.destroy();
        }
        this.clients.clear();
    }
    shouldAccept(request, allowedOrigins) {
        const path = request.url?.split("?")[0];
        const upgrade = request.headers.upgrade;
        const origin = request.headers.origin;
        return (path === "/peripherals" &&
            typeof upgrade === "string" &&
            upgrade.toLowerCase() === "websocket" &&
            (0, peripherals_config_1.isOriginAllowed)(origin, allowedOrigins));
    }
    handleClientData(socket, buffer) {
        const opcode = buffer[0] & 0x0f;
        if (opcode === 0x8) {
            socket.end(Buffer.from([0x88, 0x00]));
            this.clients.delete(socket);
            return;
        }
        if (opcode === 0x9) {
            this.safeWrite(socket, Buffer.from([0x8a, 0x00]));
        }
    }
    safeWrite(socket, data) {
        try {
            socket.write(data);
        }
        catch {
            this.clients.delete(socket);
            socket.destroy();
        }
    }
    encodeTextFrame(payload) {
        const data = Buffer.from(payload, "utf8");
        if (data.length < 126) {
            return Buffer.concat([Buffer.from([0x81, data.length]), data]);
        }
        if (data.length <= 65535) {
            const header = Buffer.alloc(4);
            header[0] = 0x81;
            header[1] = 126;
            header.writeUInt16BE(data.length, 2);
            return Buffer.concat([header, data]);
        }
        const header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(data.length), 2);
        return Buffer.concat([header, data]);
    }
};
exports.EventsService = EventsService;
exports.EventsService = EventsService = __decorate([
    (0, common_1.Injectable)()
], EventsService);
//# sourceMappingURL=events.service.js.map