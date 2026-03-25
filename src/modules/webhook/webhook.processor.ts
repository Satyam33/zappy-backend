import { wsManager } from "../../websocket/ws.manager";

export class WebhookProcessor {
  async process(orgId: string, payload: Record<string, unknown>): Promise<void> {
    wsManager.sendToOrg(orgId, {
      type: "WEBHOOK_EVENT",
      payload
    });
  }
}
