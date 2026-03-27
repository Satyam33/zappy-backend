import type { Request, Response } from "express";
import { env } from "../../config/env";
import { WebhookProcessor } from "./webhook.processor";
import { db } from "../../config/database";

const processor = new WebhookProcessor();

export class WebhookController {
  private extractPhoneNumberId(payload: Record<string, unknown>): string | null {
    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray((entry as { changes?: unknown[] }).changes)
        ? (entry as { changes?: unknown[] }).changes!
        : [];
      for (const change of changes) {
        const metadata = (change as { value?: { metadata?: { phone_number_id?: unknown } } }).value?.metadata;
        const phoneNumberId = metadata?.phone_number_id;
        if (typeof phoneNumberId === "string" && phoneNumberId) return phoneNumberId;
      }
    }
    return null;
  }

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
    const payload = req.body as Record<string, unknown>;
    const phoneNumberId = this.extractPhoneNumberId(payload);
    let orgId = "unknown-org";
    if (phoneNumberId) {
      const org = await db("organizations").where({ phone_number_id: phoneNumberId }).select(["id"]).first();
      if (org?.id) orgId = String(org.id);
    }
    await processor.process(orgId, req.body as Record<string, unknown>);
  }
}

export const webhookController = new WebhookController();
