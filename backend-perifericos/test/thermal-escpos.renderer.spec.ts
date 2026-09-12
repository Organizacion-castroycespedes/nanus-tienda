import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTicketPrintDocument,
} from "../src/shared/escpos-mock/thermal-ticket.formatter";
import {
  containsPhysicalCut,
  renderThermalEscPos,
  THERMAL_80MM_SAFE_WIDTH_CHARS,
} from "../src/shared/escpos/thermal-escpos.renderer";

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
