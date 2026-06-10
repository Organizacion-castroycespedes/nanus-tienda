import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { isOriginAllowed } from "../../shared/config/peripherals.config";
import type {
  PeripheralEventName,
  PeripheralEventPayload,
} from "../../shared/types/peripheral.types";

type EmittedPeripheralEvent = {
  event: PeripheralEventName;
  data: PeripheralEventPayload;
};

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

@Injectable()
export class EventsService implements OnApplicationShutdown {
  private clients = new Set<Duplex>();
  private recentEvents: EmittedPeripheralEvent[] = [];
  private attached = false;

  attach(server: Server, allowedOrigins: string[]): void {
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

      const accept = createHash("sha1")
        .update(`${key}${WS_GUID}`)
        .digest("base64");

      this.safeWrite(
        socket,
        [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${accept}`,
          "",
          "",
        ].join("\r\n")
      );

      this.clients.add(socket);
      socket.on("data", (buffer) => this.handleClientData(socket, buffer));
      socket.on("close", () => this.clients.delete(socket));
      socket.on("error", () => this.clients.delete(socket));
    });

    this.attached = true;
  }

  emit(event: PeripheralEventName, data: PeripheralEventPayload): void {
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

  getRecentEvents(): EmittedPeripheralEvent[] {
    return [...this.recentEvents];
  }

  onApplicationShutdown(): void {
    for (const client of this.clients) {
      client.destroy();
    }
    this.clients.clear();
  }

  private shouldAccept(
    request: IncomingMessage,
    allowedOrigins: string[]
  ): boolean {
    const path = request.url?.split("?")[0];
    const upgrade = request.headers.upgrade;
    const origin = request.headers.origin;

    return (
      path === "/peripherals" &&
      typeof upgrade === "string" &&
      upgrade.toLowerCase() === "websocket" &&
      isOriginAllowed(origin, allowedOrigins)
    );
  }

  private handleClientData(socket: Duplex, buffer: Buffer): void {
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

  private safeWrite(socket: Duplex, data: string | Buffer): void {
    try {
      socket.write(data);
    } catch {
      this.clients.delete(socket);
      socket.destroy();
    }
  }

  private encodeTextFrame(payload: string): Buffer {
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
}
