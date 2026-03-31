import type { Request, Response } from "express";
import { ZodError } from "zod";
import { InboxService } from "./inbox.service";

const service = new InboxService();
type AppError = Error & { status?: number };

export class InboxController {
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

  async listConversations(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.listConversations({ orgId: this.ensureOrgId(req), query: req.query });
      this.sendSuccess(res, 200, "Conversations fetched", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async listMessages(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.listMessages({
        orgId: this.ensureOrgId(req),
        conversationId: String(req.params.id),
        query: req.query
      });
      this.sendSuccess(res, 200, "Messages fetched", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.sendAgentMessage({
        orgId: this.ensureOrgId(req),
        conversationId: String(req.params.id),
        body: req.body
      });
      this.sendSuccess(res, 200, "Message sent", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async patchConversation(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.patchConversation({
        orgId: this.ensureOrgId(req),
        conversationId: String(req.params.id),
        body: req.body
      });
      this.sendSuccess(res, 200, "Conversation updated", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }
}

export const inboxController = new InboxController();
