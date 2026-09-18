import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import test from "node:test";
import {
  buildTicketPrintDocument,
} from "../src/shared/escpos-mock/thermal-ticket.formatter";
import { EscPosMockCommandName } from "../src/shared/escpos-mock/escpos-mock.types";
import {
  containsPhysicalCut,
  renderThermalEscPos,
  THERMAL_80MM_SAFE_WIDTH_CHARS,
} from "../src/shared/escpos/thermal-escpos.renderer";

const buildRgbPng = (width: number, height: number): string => {
  const row = Buffer.alloc(1 + width * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const chunk = (type: string, data: Buffer) => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(data.length, 0);
    header.write(type, 4, "ascii");
    return Buffer.concat([header, data, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
};

test("THERMAL_80MM document wraps long text and keeps monetary totals within safe width", () => {
  const document = buildTicketPrintDocument({
    ticketType: "SALE",
    terminalId: "local-terminal",
    deviceId: "usb-printer-1f0028d1fa5243c2",
    widthChars: THERMAL_80MM_SAFE_WIDTH_CHARS,
    timestamp: "2026-08-21T00:00:00.000Z",
    content: {
      items: [{
        name: "IDENTIFICADOR-MUY-LARGO-QUE-NO-DEBE-SALIRSE-DEL-ANCHO-SEGURO-DEL-TICKET",
        quantity: 1,
        total: 40000,
      }],
      total: 40000,
      footer: "Gracias por comprar en Manus POS",
    },
  });

  for (const line of document.preview.split("\n")) {
    assert.ok(line.length <= THERMAL_80MM_SAFE_WIDTH_CHARS, line);
  }
  assert.match(document.preview, /\$ 40,000/);
  assert.match(document.preview, /IDENTIFICADOR-MUY-LARGO/);
});

test("THERMAL_58MM document wraps long text within 32 chars", () => {
  const document = buildTicketPrintDocument({
    ticketType: "SALE",
    terminalId: "local-terminal",
    deviceId: "usb-printer-1f0028d1fa5243c2",
    widthChars: 32,
    timestamp: "2026-08-21T00:00:00.000Z",
    content: {
      header: "QA 58MM",
      businessName: "Manus POS",
      items: [
        {
          name: "PRODUCTO-MUY-LARGO-PARA-58MM-QUE-DEBE-ENVOLVER-BIEN",
          quantity: 2,
          unitPrice: 12345,
          total: 24690,
        },
      ],
      subtotal: 24690,
      taxes: 0,
      total: 24690,
      paid: 30000,
      change: 5310,
      footer: "Fin QA local",
      payments: [{ method: "EFECTIVO", amount: 30000 }],
    },
  });

  for (const line of document.preview.split("\n")) {
    assert.ok(line.length <= 32, line);
  }
  assert.match(document.preview, /QA 58MM/);
  assert.match(document.preview, /PRODUCTO-MUY-LARGO/);
  assert.match(document.preview, /\$ 24,690/);
  assert.match(document.preview, /EFECTIVO/);
});

test("ticket document prints tax breakdown lines when present", () => {
  const document = buildTicketPrintDocument({
    ticketType: "SALE",
    terminalId: "local-terminal",
    deviceId: "printer-1",
    widthChars: THERMAL_80MM_SAFE_WIDTH_CHARS,
    timestamp: "2026-08-21T00:00:00.000Z",
    content: {
      subtotal: 40000,
      taxes: 7600,
      taxLines: [
        { label: "IVA 19%", amount: 7600 },
        { label: "INC", amount: 0 },
      ],
      total: 47600,
    },
  });

  assert.match(document.preview, /IVA 19%/);
  assert.match(document.preview, /INC/);
  assert.doesNotMatch(document.preview, /Impuestos/);
});

test("RAW ESC/POS contains CUT only when physical cut is enabled", () => {
  const document = buildTicketPrintDocument({
    ticketType: "SALE",
    terminalId: "local-terminal",
    deviceId: "printer-1",
    widthChars: THERMAL_80MM_SAFE_WIDTH_CHARS,
    timestamp: "2026-08-21T00:00:00.000Z",
    content: { total: 40000 },
  });
  const rawWithCut = renderThermalEscPos(document.commands, document.preview, {
    includePhysicalCut: true,
  });
  const rawWithoutCut = renderThermalEscPos(document.commands, document.preview, {
    includePhysicalCut: false,
  });

  assert.equal(containsPhysicalCut(rawWithCut), true);
  assert.equal(containsPhysicalCut(rawWithoutCut), false);
  const footerOffset = rawWithCut.indexOf(Buffer.from("Gracias por su compra", "latin1"));
  const finalFeedOffset = rawWithCut.indexOf(Buffer.from([0x1b, 0x64, 0x06]));
  const cutOffset = rawWithCut.indexOf(Buffer.from([0x1d, 0x56, 0x00]));

  assert.ok(footerOffset >= 0);
  assert.ok(footerOffset < finalFeedOffset);
  assert.ok(finalFeedOffset < cutOffset);
  assert.equal(cutOffset, rawWithCut.length - 3);
  assert.deepEqual([...rawWithCut.subarray(-3)], [0x1d, 0x56, 0x00]);
});

test("native QR command carries the authoritative payload bytes for 80mm and 58mm", () => {
  const qrPayload = "NumFac: SETP990000009\nCUFE: authoritative-value";
  for (const widthChars of [THERMAL_80MM_SAFE_WIDTH_CHARS, 32]) {
    const document = buildTicketPrintDocument({
      ticketType: "ELECTRONIC_INVOICE",
      terminalId: "local-terminal",
      deviceId: "printer-1",
      widthChars,
      timestamp: "2026-08-21T00:00:00.000Z",
      content: { qrPayload, total: 32000 },
    });
    const command = document.commands.find((item) => item.name === EscPosMockCommandName.QrCode);
    assert.equal(command?.payload, qrPayload);
    assert.equal(command?.size, 4);
    const raw = renderThermalEscPos(document.commands, document.preview, { includePhysicalCut: false });
    assert.ok(raw.includes(Buffer.from(qrPayload, "utf8")));
  }
});

test("commercial POS ticket has no QR command", () => {
  const document = buildTicketPrintDocument({
    ticketType: "SALE",
    terminalId: "local-terminal",
    deviceId: "printer-1",
    widthChars: THERMAL_80MM_SAFE_WIDTH_CHARS,
    timestamp: "2026-08-21T00:00:00.000Z",
    content: { total: 40000 },
  });

  assert.equal(
    document.commands.filter((command) => command.name === EscPosMockCommandName.QrCode).length,
    0
  );
});

test("commercial ticket omits technical metadata and preserves Spanish CP858 text", () => {
  const document = buildTicketPrintDocument({
    ticketType: "ELECTRONIC_INVOICE",
    terminalId: "internal-terminal-id",
    deviceId: "internal-device-id",
    widthChars: THERMAL_80MM_SAFE_WIDTH_CHARS,
    timestamp: "2026-09-12T12:00:00.000Z",
    content: {
      title: "FACTURA ELECTRÓNICA DE VENTA",
      businessName: "Empresa Comercial S.A.S.",
      address: "Dirección: Medellín",
      customerName: "Cliente Ñandú",
      customerIdentification: "CC 123",
      documentNumber: "SETP990000009",
      fiscalStatus: "ACEPTADA POR LA DIAN",
      cufe: "CUFE-AUTHORITATIVE",
      total: 32000,
    },
  });

  assert.doesNotMatch(document.preview, /Tipo|Terminal|Device|internal-terminal-id|internal-device-id/);
  assert.match(document.preview, /FACTURA ELECTRÓNICA DE VENTA/);
  assert.match(document.preview, /Cliente Ñandú/);
  assert.match(document.preview, /CUFE-AUTHORITATIVE/);

  const raw = renderThermalEscPos(document.commands, document.preview, { encoding: "cp858", includePhysicalCut: false });
  const cp858Command = raw.indexOf(Buffer.from([0x1b, 0x74, 19]));
  assert.ok(cp858Command >= 0);
  assert.ok(raw.includes(Buffer.from([0x46, 0x41, 0x43, 0x54, 0x55, 0x52, 0x41, 0x20, 0x45, 0x4c, 0x45, 0x43, 0x54, 0x52, 0xe0])));
});

test("QR store-data length is exact and QR bytes come after fiscal text", () => {
  const qrPayload = "https://dian.example/qr/SETP990000009";
  const document = buildTicketPrintDocument({
    ticketType: "ELECTRONIC_INVOICE", terminalId: "internal", deviceId: "internal",
    widthChars: THERMAL_80MM_SAFE_WIDTH_CHARS, timestamp: "2026-09-15T00:00:00Z",
    content: { qrPayload, fiscalStatus: "ACEPTADA POR LA DIAN", total: 32000 },
  });
  const raw = renderThermalEscPos(document.commands, document.preview, { encoding: "cp858", includePhysicalCut: false });
  const dataLength = Buffer.byteLength(qrPayload);
  const store = Buffer.from([0x1d, 0x28, 0x6b, (dataLength + 3) & 255, (dataLength + 3) >> 8, 0x31, 0x50, 0x30]);
  const offset = raw.indexOf(store);
  assert.ok(offset > raw.indexOf(Buffer.from("ACEPTADA POR LA DIAN", "ascii")));
  assert.ok(offset >= 0);
  const center = Buffer.from([0x1b, 0x61, 0x01]);
  const centerOffset = raw.lastIndexOf(center, offset);
  assert.ok(centerOffset > raw.indexOf(Buffer.from("ACEPTADA POR LA DIAN", "ascii")));
  assert.ok(centerOffset < offset);
  assert.ok(raw.includes(Buffer.from([0x1d, 0x28, 0x6b, 0x06, 0x00, 0x31, 0x43, 0x04])));
  assert.equal(raw[offset + 3], dataLength + 3);
  assert.ok(raw.includes(Buffer.from(qrPayload, "utf8")));
});

test("large 1254px-class PNG logo downscales to the 80mm raster width", () => {
  const logo = buildRgbPng(1254, 1254);
  const document = buildTicketPrintDocument({
    ticketType: "ELECTRONIC_INVOICE",
    terminalId: "local-terminal",
    deviceId: "printer-1",
    widthChars: THERMAL_80MM_SAFE_WIDTH_CHARS,
    timestamp: "2026-09-15T00:00:00.000Z",
    content: { logo, businessName: "Empresa QA", total: 32000 },
  });
  const raw = renderThermalEscPos(document.commands, document.preview, {
    includePhysicalCut: false,
  });
  const rasterHeader = Buffer.from([0x1d, 0x76, 0x30, 0x00, 48, 0x00, 0x80, 0x01]);
  assert.ok(raw.includes(rasterHeader));
});

test("invalid or unsupported logo payloads fail soft without raster bytes", () => {
  for (const logo of [
    "data:image/png;base64,not-valid-png",
    "data:image/jpeg;base64,AAAA",
  ]) {
    const document = buildTicketPrintDocument({
      ticketType: "SALE",
      terminalId: "local-terminal",
      deviceId: "printer-1",
      widthChars: 32,
      timestamp: "2026-09-15T00:00:00.000Z",
      content: { logo, total: 1000 },
    });
    const raw = renderThermalEscPos(document.commands, document.preview, {
      includePhysicalCut: false,
    });
    assert.equal(raw.includes(Buffer.from([0x1d, 0x76, 0x30, 0x00])), false);
    assert.match(document.preview, /\$ 1,000/);
  }
});
