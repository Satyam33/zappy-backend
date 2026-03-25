import type { NextFunction, Request, Response } from "express";

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: { code: "AUTH_INVALID_TOKEN", message: "Unauthorized" } });
    return;
  }

  req.userId = "dev-user";
  next();
};
