import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DIAN_GET_ACQUIRER_ACTION } from "../../src/modules/providers/dian/dian.constants";

export type DianSoapMockServer = {
  url: string;
  close: () => Promise<void>;
  getLastRequest: () => { body: string; contentType: string } | null;
};

const fixture = (name: string): string =>
  readFileSync(join(process.cwd(), "test", "fixtures", "dian", name), "utf8");

const collectBody = (request: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });

const extractIdentificationNumber = (body: string): string | null =>
  body.match(/<dian:identificationNumber>(.*?)<\/dian:identificationNumber>/)?.[1] ??
  body.match(/<identificationNumber>(.*?)<\/identificationNumber>/)?.[1] ??
  null;

const hasGetAcquirerAction = (body: string, contentType: string): boolean =>
  contentType.includes(DIAN_GET_ACQUIRER_ACTION) ||
  body.includes(DIAN_GET_ACQUIRER_ACTION);

const sendXml = (response: ServerResponse, status: number, xml: string): void => {
  response.writeHead(status, { "Content-Type": "application/soap+xml; charset=utf-8" });
  response.end(xml);
};

export const startDianGetAcquirerSoapMockServer = (
  timeoutDelayMs = 120
): Promise<DianSoapMockServer> =>
  new Promise((resolve) => {
    let lastRequest: { body: string; contentType: string } | null = null;
    const server: Server = createServer(async (request, response) => {
      if (request.method !== "POST") {
        response.writeHead(405);
        response.end();
        return;
      }

      const body = await collectBody(request);
      const contentType = String(request.headers["content-type"] ?? "");
      lastRequest = { body, contentType };

      if (!hasGetAcquirerAction(body, contentType)) {
        response.writeHead(400);
        response.end("missing GetAcquirer action");
        return;
      }

      const identificationNumber = extractIdentificationNumber(body);
      if (identificationNumber === "0000000") {
        sendXml(response, 200, fixture("get-acquirer-not-found.xml"));
        return;
      }
      if (identificationNumber === "FAULT") {
        sendXml(response, 500, fixture("get-acquirer-soap-fault.xml"));
        return;
      }
      if (identificationNumber === "TIMEOUT") {
        setTimeout(
          () => sendXml(response, 200, fixture("get-acquirer-success.xml")),
          timeoutDelayMs
        );
        return;
      }

      sendXml(response, 200, fixture("get-acquirer-success.xml"));
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("mock server did not bind to a TCP port");
      }
      resolve({
        url: `http://127.0.0.1:${address.port}/GetAcquirer`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          }),
        getLastRequest: () => lastRequest,
      });
    });
  });
