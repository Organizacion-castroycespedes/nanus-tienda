import { randomUUID } from "node:crypto";

export const createId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
