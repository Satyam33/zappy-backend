import type { NextFunction, Request, Response } from "express";

export const planGuardMiddleware = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next();
};
