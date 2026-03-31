import { wsManager } from "../../websocket/ws.manager";
import { TemplatesService } from "../templates/templates.service";
import { InboxService } from "../inbox/inbox.service";

const templatesService = new TemplatesService();
const inboxService = new InboxService();

export class WebhookProcessor {
  private async processTemplateStatusUpdate(orgId: string, payload: Record<string, unknown>): Promise<void> {
    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray((entry as { changes?: unknown[] }).changes)
        ? (entry as { changes?: unknown[] }).changes!
        : [];
      for (const change of changes) {
        const field = (change as { field?: unknown }).field;
        const value = (change as {
          value?: {
            event?: unknown;
            message_template_id?: unknown;
            message_template_name?: unknown;
            status?: unknown;
            reason?: unknown;
            rejected_reason?: unknown;
          };
        }).value;
        if (field !== "message_template_status_update" && value?.event !== "APPROVAL_UPDATE") continue;
        await templatesService.handleWebhookTemplateStatus({
          orgId,
          metaTemplateId: typeof value?.message_template_id === "string" ? value.message_template_id : undefined,
          templateName: typeof value?.message_template_name === "string" ? value.message_template_name : undefined,
          status: typeof value?.status === "string" ? value.status : undefined,
          rejectionReason:
            typeof value?.rejected_reason === "string"
              ? value.rejected_reason
              : typeof value?.reason === "string"
                ? value.reason
                : undefined
        });
      }
    }
  }

  async process(orgId: string, payload: Record<string, unknown>): Promise<void> {
    if (orgId !== "unknown-org") {
      await this.processTemplateStatusUpdate(orgId, payload);
      await inboxService.processWebhook(orgId, payload);
    }
    wsManager.sendToOrg(orgId, {
      type: "WEBHOOK_EVENT",
      payload
    });
  }
}
