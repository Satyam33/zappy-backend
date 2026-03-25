import type { NextFunction, Request, Response } from "express";

export const requestLogger = (req: Request, _res: Response, next: NextFunction): void => {
  // eslint-disable-next-line no-console
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
};
