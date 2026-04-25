import { Injectable } from "@nestjs/common";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlMs: number;

  constructor() {
    const ttlSeconds = Number(process.env.CACHE_TTL_SECONDS ?? 300);
    this.defaultTtlMs = Number.isFinite(ttlSeconds) ? ttlSeconds * 1000 : 300000;
  }

  get<T>(tenantId: string, namespace: string, key: string): T | null {
    const cacheKey = this.buildKey(tenantId, namespace, key);
    const entry = this.store.get(cacheKey);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(cacheKey);
      return null;
    }
    return entry.value as T;
  }

  set<T>(
    tenantId: string,
    namespace: string,
    key: string,
    value: T,
    ttlMs?: number
  ) {
    const cacheKey = this.buildKey(tenantId, namespace, key);
    const ttl = typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : this.defaultTtlMs;
    this.store.set(cacheKey, { expiresAt: Date.now() + ttl, value });
  }

  async getOrSet<T>(
    tenantId: string,
    namespace: string,
    key: string,
    loader: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get<T>(tenantId, namespace, key);
    if (cached !== null) {
      return cached;
    }
    const value = await loader();
    this.set(tenantId, namespace, key, value, ttlMs);
    return value;
  }

  invalidateTenantNamespace(tenantId: string, namespace: string, keyPrefix?: string) {
    const prefix = `${namespace}:${tenantId}:${keyPrefix ?? ""}`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  private buildKey(tenantId: string, namespace: string, key: string) {
    return `${namespace}:${tenantId}:${key}`;
  }
}
