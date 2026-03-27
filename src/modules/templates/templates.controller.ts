import type { Request, Response } from "express";
import { ZodError } from "zod";
import { TemplatesService } from "./templates.service";

const service = new TemplatesService();
type AppError = Error & { status?: number };

export class TemplatesController {
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
      const data = await service.list({ orgId: this.ensureOrgId(req), query: req.query });
      this.sendSuccess(res, 200, "Templates fetched", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.create({ orgId: this.ensureOrgId(req), body: req.body });
      this.sendSuccess(res, 201, "Template created", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.update({
        orgId: this.ensureOrgId(req),
        id: String(req.params.id),
        body: req.body
      });
      this.sendSuccess(res, 200, "Template updated", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }
}

export const templatesController = new TemplatesController();
