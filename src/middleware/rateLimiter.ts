import type { NextFunction, Request, Response } from "express";

export const rateLimiterMiddleware = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next();
};
