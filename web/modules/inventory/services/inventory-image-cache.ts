import { apiBlobClient } from "../../../lib/http";
import { normalizeInventoryImageApiPath } from "../utils/inventory-image-upload";

type CacheEntry = {
  objectUrl: string;
  expiresAt: number;
  lastAccessedAt: number;
};

export const INVENTORY_IMAGE_CACHE_DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const INVENTORY_IMAGE_CACHE_MAX_ENTRIES = 120; // Maximum blobs in RAM

const imageCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<string>>();

export const getCachedInventoryImageUrl = (apiPath: string): string | null => {
  const normalized = normalizeInventoryImageApiPath(apiPath);
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) {
    return normalized;
  }
  const entry = imageCache.get(normalized);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    URL.revokeObjectURL(entry.objectUrl);
    imageCache.delete(normalized);
    return null;
  }
  entry.lastAccessedAt = Date.now();
  return entry.objectUrl;
};

const evictOldestEntryIfNeeded = () => {
  if (imageCache.size < INVENTORY_IMAGE_CACHE_MAX_ENTRIES) {
    return;
  }

  let oldestKey: string | null = null;
  let oldestAccess = Infinity;

  for (const [key, entry] of imageCache.entries()) {
    if (entry.lastAccessedAt < oldestAccess) {
      oldestAccess = entry.lastAccessedAt;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    const entry = imageCache.get(oldestKey);
    if (entry) {
      URL.revokeObjectURL(entry.objectUrl);
      imageCache.delete(oldestKey);
    }
  }
};

export const fetchAndCacheInventoryImage = async (
  rawPath: string,
  options?: {
    ttlMs?: number;
    forceRefresh?: boolean;
  }
): Promise<string> => {
  const apiPath = normalizeInventoryImageApiPath(rawPath);
  if (!apiPath) {
    throw new Error("Invalid image path");
  }

  if (apiPath.startsWith("blob:") || apiPath.startsWith("data:")) {
    return apiPath;
  }

  const ttlMs = options?.ttlMs ?? INVENTORY_IMAGE_CACHE_DEFAULT_TTL_MS;
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh) {
    const existing = getCachedInventoryImageUrl(apiPath);
    if (existing) {
      return existing;
    }
  }

  const inFlight = inFlightRequests.get(apiPath);
  if (inFlight && !forceRefresh) {
    return inFlight;
  }

  const fetchPromise = (async () => {
    try {
      const blob = await apiBlobClient(apiPath);
      const objectUrl = URL.createObjectURL(blob);

      // If we previously had an entry (e.g. on forceRefresh or expired), revoke old URL
      const prior = imageCache.get(apiPath);
      if (prior) {
        URL.revokeObjectURL(prior.objectUrl);
      }

      evictOldestEntryIfNeeded();

      const now = Date.now();
      imageCache.set(apiPath, {
        objectUrl,
        expiresAt: now + ttlMs,
        lastAccessedAt: now,
      });

      return objectUrl;
    } finally {
      inFlightRequests.delete(apiPath);
    }
  })();

  inFlightRequests.set(apiPath, fetchPromise);
  return fetchPromise;
};

export const invalidateInventoryImageCache = (rawPath?: string | null) => {
  if (!rawPath) {
    for (const entry of imageCache.values()) {
      URL.revokeObjectURL(entry.objectUrl);
    }
    imageCache.clear();
    inFlightRequests.clear();
  } else {
    const apiPath = normalizeInventoryImageApiPath(rawPath);
    if (apiPath) {
      const entry = imageCache.get(apiPath);
      if (entry) {
        URL.revokeObjectURL(entry.objectUrl);
        imageCache.delete(apiPath);
      }
      inFlightRequests.delete(apiPath);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("manus:inventory-image-invalidated", {
        detail: { path: rawPath ?? null },
      })
    );
  }
};

export const getInventoryImageCacheSize = () => imageCache.size;

// ==========================================
// Singleton IntersectionObserver for Images
// ==========================================

type ObserverCallback = () => void;
const observerCallbacks = new Map<Element, ObserverCallback>();
let sharedObserver: IntersectionObserver | null = null;

const getOrCreateSharedObserver = (): IntersectionObserver | null => {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
    return null;
  }

  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cb = observerCallbacks.get(entry.target);
            if (cb) {
              observerCallbacks.delete(entry.target);
              sharedObserver?.unobserve(entry.target);
              cb();
            }
          }
        }
      },
      { rootMargin: "200px" }
    );
  }

  return sharedObserver;
};

export const observeInventoryImageElement = (
  element: HTMLElement | null,
  onIntersect: ObserverCallback
): (() => void) => {
  if (!element) {
    return () => {};
  }

  const observer = getOrCreateSharedObserver();
  if (!observer) {
    onIntersect();
    return () => {};
  }

  observerCallbacks.set(element, onIntersect);
  observer.observe(element);

  return () => {
    observerCallbacks.delete(element);
    observer.unobserve(element);
  };
};
