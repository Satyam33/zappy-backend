import { z } from "zod";
import { db } from "../../config/database";
import { WhatsAppService } from "../../services/whatsapp.service";
import { InboxRepository } from "./inbox.repository";
import { wsManager } from "../../websocket/ws.manager";

const repository = new InboxRepository();
const whatsappService = new WhatsAppService();

const ListConversationsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  status: z.enum(["all", "open", "resolved"]).default("all")
});

const ListMessagesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

const SendMessageSchema = z.object({
  text: z.string().min(1).max(4096)
});

const PatchConversationSchema = z.object({
  status: z.enum(["open", "resolved"]).optional(),
  markRead: z.boolean().optional()
});

type WebhookMsg = { from: string; id: string; ts: number; body: string; type: string };
type WebhookStatus = { id: string; status: string; ts?: number };

export class InboxService {
  private mapMsgStatus(s: string): "sent" | "delivered" | "read" | "failed" {
    const v = s.toLowerCase();
    if (v === "read") return "read";
    if (v === "delivered") return "delivered";
    if (v === "failed") return "failed";
    return "sent";
  }

  private extractWebhookPayload(payload: Record<string, unknown>): { messages: WebhookMsg[]; statuses: WebhookStatus[] } {
    const messages: WebhookMsg[] = [];
    const statuses: WebhookStatus[] = [];
    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray((entry as { changes?: unknown[] }).changes)
        ? (entry as { changes: unknown[] }).changes
        : [];
      for (const change of changes) {
        const ch = change as { field?: string; value?: Record<string, unknown> };
        if (ch.field !== "messages") continue;
        const value = ch.value || {};
        const contacts = Array.isArray(value.contacts) ? value.contacts : [];
        const nameByWa: Record<string, string> = {};
        for (const c of contacts) {
          const cc = c as { wa_id?: string; profile?: { name?: string } };
          if (cc.wa_id && cc.profile?.name) nameByWa[String(cc.wa_id)] = String(cc.profile.name);
        }
        const msgs = Array.isArray(value.messages) ? value.messages : [];
        for (const m of msgs) {
          const mm = m as {
            from?: string;
            id?: string;
            timestamp?: string;
            type?: string;
            text?: { body?: string };
            button?: { text?: string };
            interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
          };
          const from = mm.from ? String(mm.from) : "";
          const id = mm.id ? String(mm.id) : "";
          if (!from || !id) continue;
          const ts = mm.timestamp ? Number(mm.timestamp) : Math.floor(Date.now() / 1000);
          const type = String(mm.type || "unknown");
          let body = "";
          if (type === "text" && mm.text?.body) body = String(mm.text.body);
          else if (type === "button" && mm.button?.text) body = String(mm.button.text);
          else if (type === "interactive") {
            body =
              String(mm.interactive?.button_reply?.title || mm.interactive?.list_reply?.title || "").trim() || "[Interactive]";
          } else body = `[${type}]`;
          messages.push({ from, id, ts, body, type });
        }
        const sts = Array.isArray(value.statuses) ? value.statuses : [];
        for (const s of sts) {
          const ss = s as { id?: string; status?: string; timestamp?: string };
          if (ss.id && ss.status) {
            statuses.push({
              id: String(ss.id),
              status: String(ss.status),
              ts: ss.timestamp ? Number(ss.timestamp) : undefined
            });
          }
        }
      }
    }
    return { messages, statuses };
  }

  private displayNameForConversation(row: {
    contact_name?: string | null;
    contact_phone_e164?: string | null;
    contact_phone?: string;
  }): string {
    if (row.contact_name?.trim()) return row.contact_name.trim();
    if (row.contact_phone_e164) return row.contact_phone_e164;
    return repository.formatDisplayPhone(String(row.contact_phone || ""));
  }

  private displayPhoneForConversation(row: {
    contact_phone_e164?: string | null;
    contact_phone?: string;
  }): string {
    if (row.contact_phone_e164) return String(row.contact_phone_e164);
    return repository.formatDisplayPhone(String(row.contact_phone || ""));
  }

  private normalizeConversationRow(row: Record<string, unknown>): Record<string, unknown> {
    const tags = Array.isArray(row.contact_tags) ? row.contact_tags.map((t: unknown) => String(t)) : [];
    const firstTag = tags[0];
    return {
      id: String(row.id),
      contactId: row.contact_id ? String(row.contact_id) : "",
      contactName: this.displayNameForConversation(row as never),
      contactPhone: this.displayPhoneForConversation(row as never),
      contactTag: firstTag,
      lastMessage: String(row.last_message_preview || ""),
      lastMessageAt: row.last_message_at ? new Date(String(row.last_message_at)).toISOString() : new Date().toISOString(),
      unreadCount: Number(row.unread_count ?? 0),
      status: row.status === "resolved" ? "resolved" : "open"
    };
  }

  private normalizeMessageRow(row: Record<string, unknown>): Record<string, unknown> {
    const convId = row.conversation_id ?? row.conversationId;
    return {
      id: String(row.id),
      conversationId: String(convId ?? ""),
      content: String(row.body || ""),
      direction: row.direction === "outbound" ? "outbound" : "inbound",
      status: this.mapMsgStatus(String(row.status || "sent")),
      createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
      messageType: String(row.message_type || "text"),
      source: String(row.source || "customer"),
      wamid: row.wamid ? String(row.wamid) : null
    };
  }

  private emit(orgId: string, payload: Record<string, unknown>): void {
    wsManager.sendToOrg(orgId, { type: "INBOX_EVENT", ...payload });
  }

  async processWebhook(orgId: string, payload: Record<string, unknown>): Promise<void> {
    if (orgId === "unknown-org") return;
    const { messages, statuses } = this.extractWebhookPayload(payload);
    for (const st of statuses) {
      const mapped = this.mapMsgStatus(st.status);
      await repository.updateMessageStatusByWamid({ orgId, wamid: st.id, status: mapped });
    }
    for (const m of messages) {
      const digits = repository.normalizeDigits(m.from);
      const contact = await repository.findContactByPhone(orgId, digits);
      const conv = await repository.findOrCreateConversation({
        orgId,
        contactPhoneDigits: digits,
        contactId: contact?.id ?? null,
        contactNameFallback: contact?.name || `WhatsApp ${m.from}`
      });
      const at = new Date(m.ts * 1000);
      const inserted = await repository.insertMessage({
        orgId,
        conversationId: conv.id,
        wamid: m.id,
        direction: "inbound",
        body: m.body,
        messageType: m.type,
        status: "delivered",
        source: "customer",
        meta: { rawType: m.type }
      });
      if (!inserted) continue;
      await repository.bumpConversationAfterMessage({
        conversationId: conv.id,
        preview: m.body,
        at,
        inbound: true
      });
      const full = await repository.getConversation({ orgId, id: conv.id });
      this.emit(orgId, {
        event: "message",
        conversation: full ? this.normalizeConversationRow(full) : null,
        message: this.normalizeMessageRow({
          id: inserted.id,
          conversation_id: conv.id,
          body: m.body,
          direction: "inbound",
          status: "delivered",
          created_at: at.toISOString(),
          message_type: m.type,
          source: "customer",
          wamid: m.id
        })
      });
    }
  }

  async appendOutboundCampaignMessage(input: {
    orgId: string;
    toPhoneRaw: string;
    wamid?: string;
    preview: string;
    campaignId: string;
    templateName: string;
  }): Promise<void> {
    const digits = repository.normalizeDigits(input.toPhoneRaw);
    const contact = await repository.findContactByPhone(input.orgId, digits);
    const conv = await repository.findOrCreateConversation({
      orgId: input.orgId,
      contactPhoneDigits: digits,
      contactId: contact?.id ?? null,
      contactNameFallback: contact?.name || repository.formatDisplayPhone(digits)
    });
    const at = new Date();
    const inserted = await repository.insertMessage({
      orgId: input.orgId,
      conversationId: conv.id,
      wamid: input.wamid ?? null,
      direction: "outbound",
      body: input.preview,
      messageType: "template",
      status: "sent",
      source: "campaign",
      campaignId: input.campaignId,
      meta: { templateName: input.templateName }
    });
    if (!inserted) return;
    await repository.bumpConversationAfterMessage({
      conversationId: conv.id,
      preview: input.preview,
      at,
      inbound: false
    });
    const full = await repository.getConversation({ orgId: input.orgId, id: conv.id });
    this.emit(input.orgId, {
      event: "message",
      conversation: full ? this.normalizeConversationRow(full) : null,
      message: this.normalizeMessageRow({
        id: inserted.id,
        conversation_id: conv.id,
        body: input.preview,
        direction: "outbound",
        status: "sent",
        created_at: at.toISOString(),
        message_type: "template",
        source: "campaign",
        wamid: input.wamid ?? null
      })
    });
  }

  async listConversations(input: { orgId: string; query: unknown }): Promise<Record<string, unknown>> {
    const q = ListConversationsSchema.parse(input.query);
    const { rows, total } = await repository.listConversations({
      orgId: input.orgId,
      page: q.page,
      limit: q.limit,
      search: q.search,
      status: q.status
    });
    return {
      items: rows.map((r) => this.normalizeConversationRow(r)),
      total,
      page: q.page,
      limit: q.limit,
      totalPages: Math.max(1, Math.ceil(total / q.limit))
    };
  }

  async listMessages(input: { orgId: string; conversationId: string; query: unknown }): Promise<Record<string, unknown>> {
    const q = ListMessagesSchema.parse(input.query);
    const conv = await repository.getConversation({ orgId: input.orgId, id: input.conversationId });
    if (!conv) throw Object.assign(new Error("Conversation not found"), { status: 404 });
    const { rows, total } = await repository.listMessages({
      orgId: input.orgId,
      conversationId: input.conversationId,
      page: q.page,
      limit: q.limit
    });
    return {
      items: rows.map((r) => this.normalizeMessageRow(r)),
      total,
      page: q.page,
      limit: q.limit,
      totalPages: Math.max(1, Math.ceil(total / q.limit))
    };
  }

  async sendAgentMessage(input: { orgId: string; conversationId: string; body: unknown }): Promise<Record<string, unknown>> {
    const payload = SendMessageSchema.parse(input.body);
    const conv = await repository.getConversation({ orgId: input.orgId, id: input.conversationId });
    if (!conv) throw Object.assign(new Error("Conversation not found"), { status: 404 });
    const org = await db("organizations")
      .where({ id: input.orgId })
      .select(["phone_number_id", "access_token"])
      .first();
    if (!org?.phone_number_id || !org?.access_token) {
      throw Object.assign(new Error("WhatsApp API is not configured for this org"), { status: 400 });
    }
    const toDigits = String(conv.contact_phone || "");
    const phoneE164 = repository.formatDisplayPhone(toDigits);
    const res = await whatsappService.sendTextMessage({
      accessToken: String(org.access_token),
      phoneNumberId: String(org.phone_number_id),
      to: phoneE164,
      text: payload.text
    });
    const wamid = res.messages?.[0]?.id;
    const at = new Date();
    const inserted = await repository.insertMessage({
      orgId: input.orgId,
      conversationId: input.conversationId,
      wamid: wamid ?? null,
      direction: "outbound",
      body: payload.text,
      messageType: "text",
      status: "sent",
      source: "agent",
      meta: {}
    });
    if (inserted) {
      await repository.bumpConversationAfterMessage({
        conversationId: input.conversationId,
        preview: payload.text,
        at,
        inbound: false
      });
    }
    const full = await repository.getConversation({ orgId: input.orgId, id: input.conversationId });
    const msgRow =
      inserted &&
      this.normalizeMessageRow({
        id: inserted.id,
        conversation_id: input.conversationId,
        body: payload.text,
        direction: "outbound",
        status: "sent",
        created_at: at.toISOString(),
        message_type: "text",
        source: "agent",
        wamid: wamid ?? null
      });
    if (full && msgRow) {
      this.emit(input.orgId, {
        event: "message",
        conversation: this.normalizeConversationRow(full),
        message: msgRow
      });
    }
    return { ok: true, message: msgRow };
  }

  async patchConversation(input: { orgId: string; conversationId: string; body: unknown }): Promise<Record<string, unknown>> {
    const payload = PatchConversationSchema.parse(input.body);
    const cleared = payload.markRead;
    const updated = await repository.updateConversation({
      orgId: input.orgId,
      id: input.conversationId,
      status: payload.status,
      clearUnread: cleared
    });
    if (!updated) throw Object.assign(new Error("Conversation not found"), { status: 404 });
    const full = await repository.getConversation({ orgId: input.orgId, id: input.conversationId });
    const norm = full ? this.normalizeConversationRow(full) : null;
    if (norm) {
      this.emit(input.orgId, { event: "conversation_updated", conversation: norm });
    }
    return norm ?? {};
  }
}
