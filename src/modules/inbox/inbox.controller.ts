import type { Request, Response } from "express";
import { InboxService } from "./inbox.service";

const service = new InboxService();

export class InboxController {
  async listConversations(_req: Request, res: Response): Promise<void> {
    const conversations = await service.listConversations();
    res.status(200).json({ data: conversations });
  }
}

export const inboxController = new InboxController();
