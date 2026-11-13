import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  deleteReceiptAttachment,
  resolveAttachmentPath,
  saveReceiptAttachment,
  validateReceiptAttachment,
} from "./receipt-attachments";

const pdf = Buffer.from("%PDF-1.7\n%test\n");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const MB = 1024 * 1024;

test("accepts a real PDF and normalizes the name", () => {
  const result = validateReceiptAttachment({ originalname: "soporte pago.PDF", mimetype: "application/pdf", size: pdf.length, buffer: pdf }, 5 * MB);
  assert.equal(result.mime, "application/pdf");
  assert.equal(result.extension, ".pdf");
});

test("rejects an executable renamed as PDF", () => {
  const exe = Buffer.from("MZ\x90\x00binary");
  assert.throws(
    () => validateReceiptAttachment({ originalname: "pago.pdf", mimetype: "application/pdf", size: exe.length, buffer: exe }, 5 * MB),
    (error: any) => error.getResponse().code === "CONTROL_CENTER_ATTACHMENT_SIGNATURE",
  );
});

test("rejects mismatched extension, unknown type, empty and oversized files", () => {
  const code = (fn: () => unknown) => {
    try {
      fn();
      return null;
    } catch (error: any) {
      return error.getResponse().code;
    }
  };
  assert.equal(code(() => validateReceiptAttachment({ originalname: "a.jpg", mimetype: "image/png", buffer: png }, MB)), "CONTROL_CENTER_ATTACHMENT_TYPE");
  assert.equal(code(() => validateReceiptAttachment({ originalname: "a.exe", mimetype: "application/x-msdownload", buffer: png }, MB)), "CONTROL_CENTER_ATTACHMENT_TYPE");
  assert.equal(code(() => validateReceiptAttachment({ originalname: "a.png", mimetype: "image/png", buffer: Buffer.alloc(0) }, MB)), "CONTROL_CENTER_ATTACHMENT_EMPTY");
  assert.equal(code(() => validateReceiptAttachment({ originalname: "a.png", mimetype: "image/png", size: 6 * MB, buffer: png }, 5 * MB)), "CONTROL_CENTER_ATTACHMENT_TOO_LARGE");
});

test("stores under control-center/receipts with a random name and refuses path traversal", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "cc-receipts-"));
  try {
    const attachment = validateReceiptAttachment({ originalname: "x.png", mimetype: "image/png", buffer: png }, MB);
    const key = await saveReceiptAttachment(attachment, "2027-01-15", dir);
    assert.match(key, /^control-center\/receipts\/2027\/01\/[0-9a-f-]{36}\.png$/);
    assert.deepEqual(await readFile(path.join(dir, key)), png);
    await deleteReceiptAttachment(key, dir);
    assert.throws(() => resolveAttachmentPath("../../etc/passwd", dir));
    assert.throws(() => resolveAttachmentPath("control-center/receipts/2027/01/../../x.png", dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
