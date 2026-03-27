import type { Request, Response } from "express";
import { ZodError } from "zod";
import { ContactsService } from "./contacts.service";

const service = new ContactsService();
type AppError = Error & { status?: number };

export class ContactsController {
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
    if (!req.orgId) throw Object.assign(new Error("No organization context"), { status: 403 });
    return req.orgId;
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.list({ orgId: this.ensureOrgId(req), query: req.query });
      this.sendSuccess(res, 200, "Contacts fetched", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.create({ orgId: this.ensureOrgId(req), body: req.body });
      this.sendSuccess(res, 201, "Contact created", data);
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
      this.sendSuccess(res, 200, "Contact updated", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.delete({
        orgId: this.ensureOrgId(req),
        id: String(req.params.id)
      });
      this.sendSuccess(res, 200, "Contact deleted", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async bulkDelete(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.bulkDelete({
        orgId: this.ensureOrgId(req),
        body: req.body
      });
      this.sendSuccess(res, 200, "Contacts deleted", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }
}

export const contactsController = new ContactsController();
