import type { NextFunction, Request, Response } from "express";

export const tenantMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const orgId = typeof req.headers["x-org-id"] === "string" ? req.headers["x-org-id"] : null;
  if (!orgId) {
    res.status(403).json({ error: { code: "AUTH_NO_ORG", message: "No organization context" } });
    return;
  }
  req.orgId = orgId;
  req.role = "admin";
  req.org = { id: orgId };
  next();
};
