import type { Request, Response } from "express";
import { ZodError } from "zod";
import { SettingsService } from "./settings.service";

const service = new SettingsService();

type AppError = Error & { status?: number };

export class SettingsController {
  private sendSuccess<T>(res: Response, code: number, message: string, data: T): void {
    res.status(code).json({ success: true, code, message, data });
  }

  private sendError(res: Response, err: unknown): void {
    if (err instanceof ZodError) {
      res.status(400).json({
        success: false,
        code: 400,
        message: err.issues[0]?.message || "Invalid request payload"
      });
      return;
    }

    const appError = err as AppError;
    const status = appError.status ?? 500;
    res.status(status).json({
      success: false,
      code: status,
      message: appError.message || "Something went wrong"
    });
  }

  private ensureOrgId(req: Request): string {
    if (!req.orgId) {
      throw Object.assign(new Error("No organization context"), { status: 403 });
    }
    return req.orgId;
  }

  async whatsapp(req: Request, res: Response): Promise<void> {
    try {
      const orgId = this.ensureOrgId(req);
      const data = await service.whatsappSettings(orgId);
      this.sendSuccess(res, 200, "WhatsApp settings fetched", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async updateWhatsapp(req: Request, res: Response): Promise<void> {
    try {
      const orgId = this.ensureOrgId(req);
      const data = await service.updateWhatsappSettings(orgId, req.body);
      this.sendSuccess(res, 200, "WhatsApp settings updated", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async whatsappStatus(req: Request, res: Response): Promise<void> {
    try {
      const orgId = this.ensureOrgId(req);
      const data = await service.whatsappConnectionStatus(orgId);
      this.sendSuccess(res, 200, "WhatsApp connection status fetched", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }
}

export const settingsController = new SettingsController();
