import type { Request, Response } from "express";
import { ZodError } from "zod";
import { CampaignsService } from "./campaigns.service";

const service = new CampaignsService();
type AppError = Error & { status?: number };

export class CampaignsController {
  private ensureOrgId(req: Request): string {
    if (!req.orgId) throw Object.assign(new Error("No organization context"), { status: 403 });
    return req.orgId;
  }

  private sendSuccess<T>(res: Response, code: number, message: string, data: T): void {
    res.status(code).json({ success: true, code, message, data });
  }

  private sendError(res: Response, err: unknown): void {
    if (err instanceof ZodError) {
      res.status(400).json({ success: false, code: 400, message: err.issues[0]?.message || "Invalid request payload" });
      return;
    }
    const e = err as AppError;
    res.status(e.status ?? 500).json({ success: false, code: e.status ?? 500, message: e.message || "Something went wrong" });
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.list({ orgId: this.ensureOrgId(req) });
      this.sendSuccess(res, 200, "Campaigns fetched", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async meta(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.meta({ orgId: this.ensureOrgId(req) });
      this.sendSuccess(res, 200, "Campaign metadata fetched", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async previewAudience(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.previewAudience({ orgId: this.ensureOrgId(req), body: req.body });
      this.sendSuccess(res, 200, "Audience preview fetched", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.create({ orgId: this.ensureOrgId(req), body: req.body });
      this.sendSuccess(res, 201, "Campaign created", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }
}

export const campaignsController = new CampaignsController();
