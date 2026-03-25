import type { NextFunction, Request, Response } from "express";

type AppError = Error & { status?: number; code?: string };

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const status = err.status ?? 500;
  const code = err.code ?? "INTERNAL_ERROR";
  const message = err.message || "Something went wrong";
  res.status(status).json({ error: { code, message } });
};
