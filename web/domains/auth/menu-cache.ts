import type { MenuResponse } from "../menu/types";

const MENU_CACHE_KEY_PREFIX = "smg_menu_cache_v1";
const MENU_CACHE_TTL_MS = 10 * 60 * 1000;

type MenuCachePayload = {
  tenantId: string;
  cachedAt: number;
  items: MenuResponse["items"];
};

type EncryptedPayload = {
  iv: string;
  data: string;
};

const hasStorage = () => typeof window !== "undefined" && Boolean(window.sessionStorage);
const hasCrypto = () => typeof window !== "undefined" && Boolean(window.crypto?.subtle);

const getCacheKey = (tenantId: string) => `${MENU_CACHE_KEY_PREFIX}:${tenantId}`;

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const deriveKey = async (secret: string) => {
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret);
  const hash = await window.crypto.subtle.digest("SHA-256", secretBytes);
  return window.crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
};

const encryptPayload = async (payload: MenuCachePayload, secret: string) => {
  if (!hasCrypto()) {
    return null;
  }
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret);
  const encoded = encoder.encode(JSON.stringify(payload));
  const data = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(data)),
  } satisfies EncryptedPayload;
};

const decryptPayload = async (payload: EncryptedPayload, secret: string) => {
  if (!hasCrypto()) {
    return null;
  }
  const decoder = new TextDecoder();
  const key = await deriveKey(secret);
  const iv = base64ToBytes(payload.iv);
  const data = base64ToBytes(payload.data);
  const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(decoder.decode(decrypted)) as MenuCachePayload;
};

export const persistMenuCache = async (
  accessToken: string,
  tenantId: string,
  items: MenuResponse["items"]
) => {
  if (!hasStorage()) {
    return;
  }
  const encrypted = await encryptPayload(
    {
      tenantId,
      cachedAt: Date.now(),
      items,
    },
    accessToken
  );
  if (!encrypted) {
    return;
  }
  window.sessionStorage.setItem(getCacheKey(tenantId), JSON.stringify(encrypted));
};

export const readMenuCache = async (accessToken: string, tenantId: string) => {
  if (!hasStorage()) {
    return null;
  }
  const raw = window.sessionStorage.getItem(getCacheKey(tenantId));
  if (!raw) {
    return null;
  }
  try {
    const encrypted = JSON.parse(raw) as EncryptedPayload;
    const payload = await decryptPayload(encrypted, accessToken);
    if (!payload || payload.tenantId !== tenantId) {
      window.sessionStorage.removeItem(getCacheKey(tenantId));
      return null;
    }
    if (Date.now() - payload.cachedAt > MENU_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(getCacheKey(tenantId));
      return null;
    }
    return payload.items;
  } catch {
    window.sessionStorage.removeItem(getCacheKey(tenantId));
    return null;
  }
};

export const clearMenuCache = (tenantId?: string) => {
  if (!hasStorage()) {
    return;
  }
  if (tenantId) {
    window.sessionStorage.removeItem(getCacheKey(tenantId));
    return;
  }
  Object.keys(window.sessionStorage).forEach((key) => {
    if (key.startsWith(MENU_CACHE_KEY_PREFIX)) {
      window.sessionStorage.removeItem(key);
    }
  });
};
