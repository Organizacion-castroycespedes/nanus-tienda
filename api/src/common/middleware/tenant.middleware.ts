import type { Request, Response, NextFunction } from "express";
import { query } from "../db/pool";

export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const tenantSlug = req.headers["x-tenant"] || req.params.tenant;
  if (!tenantSlug) {
    res.status(400).json({ message: "Tenant requerido" });
    return;
  }

  const tenants = await query<{ id: string; slug: string }>(
    "SELECT id, slug FROM tenants WHERE slug = $1 AND activo = TRUE",
    [tenantSlug]
  );

  const tenant = tenants[0];
  if (!tenant) {
    res.status(404).json({ message: "Tenant no encontrado" });
    return;
  }

  req.tenant = tenant;
  next();
};
