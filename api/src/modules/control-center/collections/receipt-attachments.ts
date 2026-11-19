import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { badRequest } from "../shared/errors";

export type UploadedReceiptFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

export type ValidatedAttachment = {
  buffer: Buffer;
  mime: AttachmentMime;
  extension: string;
  originalName: string;
  size: number;
};

export type AttachmentMime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

const EXTENSIONS: Record<AttachmentMime, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const hasSignature = (buffer: Buffer, mime: AttachmentMime) => {
  switch (mime) {
    case "application/pdf":
      return buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-";
    case "image/jpeg":
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp":
      return buffer.length >= 12 && buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP";
  }
};

const cleanName = (name: string) =>
  name.replace(/[\u0000-\u001f\\/:*?"<>|]+/g, "_").trim().slice(-120) || "comprobante";

/** Valida tipo MIME, extensión, firma del archivo y tamaño máximo. */
export const validateReceiptAttachment = (file: UploadedReceiptFile, maxBytes: number): ValidatedAttachment => {
  const buffer = file.buffer;
  const size = typeof file.size === "number" ? file.size : buffer?.length ?? 0;
  if (!buffer || buffer.length === 0 || size === 0) {
    throw badRequest("CONTROL_CENTER_ATTACHMENT_EMPTY", "El comprobante está vacío");
  }
  if (size > maxBytes || buffer.length > maxBytes) {
    throw badRequest("CONTROL_CENTER_ATTACHMENT_TOO_LARGE", `El comprobante supera ${Math.floor(maxBytes / 1024 / 1024)} MB`);
  }
  const mime = (file.mimetype ?? "").toLowerCase() as AttachmentMime;
  if (!(mime in EXTENSIONS)) {
    throw badRequest("CONTROL_CENTER_ATTACHMENT_TYPE", "El comprobante debe ser PDF, JPG, PNG o WebP");
  }
  const originalName = cleanName(file.originalname ?? "");
  const extension = path.extname(originalName).toLowerCase();
  if (!EXTENSIONS[mime].includes(extension)) {
    throw badRequest("CONTROL_CENTER_ATTACHMENT_TYPE", "La extensión del comprobante no coincide con su tipo");
  }
  if (!hasSignature(buffer, mime)) {
    throw badRequest("CONTROL_CENTER_ATTACHMENT_SIGNATURE", "El contenido del comprobante no coincide con su tipo");
  }
  return { buffer, mime, extension: extension === ".jpeg" ? ".jpg" : extension, originalName, size: buffer.length };
};

export const resolveUploadsBaseDir = (env: Record<string, string | undefined> = process.env, cwd = process.cwd()) => {
  const configured = env.LOCAL_UPLOADS_DIR?.trim();
  if (configured) return path.resolve(cwd, configured);
  if (path.basename(cwd).toLowerCase() === "api") return path.resolve(cwd, "..", "storage", "uploads");
  return path.resolve(cwd, "storage", "uploads");
};

const KEY_RE = /^control-center\/receipts\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/;

/** Ruta absoluta de una clave guardada; rechaza claves fuera de la carpeta del Control Center. */
export const resolveAttachmentPath = (storageKey: string, baseDir = resolveUploadsBaseDir()) => {
  if (!KEY_RE.test(storageKey)) throw badRequest("CONTROL_CENTER_ATTACHMENT_KEY", "Clave de comprobante inválida");
  const resolved = path.resolve(baseDir, storageKey);
  if (!resolved.startsWith(path.resolve(baseDir) + path.sep)) {
    throw badRequest("CONTROL_CENTER_ATTACHMENT_KEY", "Clave de comprobante inválida");
  }
  return resolved;
};

export const saveReceiptAttachment = async (attachment: ValidatedAttachment, receivedOn: string, baseDir = resolveUploadsBaseDir()) => {
  const storageKey = `control-center/receipts/${receivedOn.slice(0, 4)}/${receivedOn.slice(5, 7)}/${randomUUID()}${attachment.extension}`;
  const target = resolveAttachmentPath(storageKey, baseDir);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, attachment.buffer, { flag: "wx", mode: 0o640 });
  return storageKey;
};

export const deleteReceiptAttachment = async (storageKey: string, baseDir = resolveUploadsBaseDir()) => {
  await unlink(resolveAttachmentPath(storageKey, baseDir)).catch(() => undefined);
};

export const readReceiptAttachment = (storageKey: string, baseDir = resolveUploadsBaseDir()) =>
  readFile(resolveAttachmentPath(storageKey, baseDir));
