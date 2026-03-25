import type { Request, Response } from "express";
import { env } from "../../config/env";
import { WebhookProcessor } from "./webhook.processor";

const processor = new WebhookProcessor();

export class WebhookController {
  verify(req: Request, res: Response): void {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === env.WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      return;
    }
    res.sendStatus(403);
  }

  async receive(req: Request, res: Response): Promise<void> {
    res.sendStatus(200);
    const orgId = typeof req.headers["x-org-id"] === "string" ? req.headers["x-org-id"] : "unknown-org";
    await processor.process(orgId, req.body as Record<string, unknown>);
  }
}

export const webhookController = new WebhookController();
