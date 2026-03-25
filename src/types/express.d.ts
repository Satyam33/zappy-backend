import type { Request } from "express";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    orgId?: string;
    role?: string;
    org?: Record<string, unknown>;
  }
}

export type AuthedRequest = Request & {
  userId: string;
  orgId: string;
};
