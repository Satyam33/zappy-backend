import { db } from "../../config/database";

export class InboxRepository {
  normalizeDigits(phone: string): string {
    return String(phone).replace(/\D/g, "");
  }

  formatDisplayPhone(digits: string): string {
    if (!digits) return "";
    return digits.startsWith("+") ? digits : `+${digits}`;
  }

  async findContactByPhone(orgId: string, digits: string): Promise<{ id: string; name: string | null; phone: string; tags: string[] } | null> {
    const row = await db("contacts")
      .where({ org_id: orgId })
      .whereRaw("regexp_replace(phone, '\\D', '', 'g') = ?", [digits])
      .select(["id", "name", "phone", "tags"])
      .first();
    if (!row) return null;
    const tags = Array.isArray(row.tags) ? row.tags.map((t: unknown) => String(t)) : [];
    return { id: String(row.id), name: row.name as string | null, phone: String(row.phone), tags };
  }

  async findOrCreateConversation(input: {
    orgId: string;
    contactPhoneDigits: string;
    contactId?: string | null;
    contactNameFallback: string;
  }): Promise<{ id: string }> {
    const existing = await db("conversations")
      .where({ org_id: input.orgId, contact_phone: input.contactPhoneDigits })
      .select(["id"])
      .first();
    if (existing) {
      if (input.contactId) {
        await db("conversations")
          .where({ id: existing.id })
          .update({ contact_id: input.contactId, updated_at: new Date() });
      }
      return { id: String(existing.id) };
    }
    const [row] = await db("conversations")
      .insert({
        org_id: input.orgId,
        contact_phone: input.contactPhoneDigits,
        contact_id: input.contactId ?? null,
        last_message_preview: null,
        last_message_at: null,
        unread_count: 0,
        status: "open",
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning("id");
    return { id: String(row.id) };
  }

  async insertMessage(input: {
    orgId: string;
    conversationId: string;
    wamid?: string | null;
    direction: "inbound" | "outbound";
    body: string;
    messageType: string;
    status: string;
    source: string;
    campaignId?: string | null;
    meta?: Record<string, unknown>;
  }): Promise<{ id: string } | null> {
    try {
      const [row] = await db("inbox_messages")
        .insert({
          org_id: input.orgId,
          conversation_id: input.conversationId,
          wamid: input.wamid ?? null,
          direction: input.direction,
          body: input.body,
          message_type: input.messageType,
          status: input.status,
          source: input.source,
          campaign_id: input.campaignId ?? null,
          meta: input.meta ?? {},
          created_at: new Date()
        })
        .returning("id");
      return { id: String(row.id) };
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "23505") return null;
      throw e;
    }
  }

  async bumpConversationAfterMessage(input: {
    conversationId: string;
    preview: string;
    at: Date;
    inbound: boolean;
  }): Promise<void> {
    const patch: Record<string, unknown> = {
      last_message_preview: input.preview.slice(0, 500),
      last_message_at: input.at,
      updated_at: new Date()
    };
    if (input.inbound) {
      patch.unread_count = db.raw("unread_count + 1");
    }
    await db("conversations").where({ id: input.conversationId }).update(patch);
  }

  async updateMessageStatusByWamid(input: { orgId: string; wamid: string; status: string }): Promise<number> {
    return db("inbox_messages")
      .where({ org_id: input.orgId, wamid: input.wamid })
      .update({ status: input.status });
  }

  async listConversations(input: {
    orgId: string;
    page: number;
    limit: number;
    search?: string;
    status?: "open" | "resolved" | "all";
  }): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
    const offset = (input.page - 1) * input.limit;
    const searchRaw = input.search?.trim() || "";
    const digits = this.normalizeDigits(searchRaw);

    const base = db("conversations").where({ org_id: input.orgId });
    if (input.status && input.status !== "all") base.andWhere({ status: input.status });
    if (searchRaw) {
      const s = `%${searchRaw}%`;
      base.andWhere((qb) => {
        qb.whereILike("last_message_preview", s);
        if (digits.length >= 4) qb.orWhereILike("contact_phone", `%${digits}%`);
        qb.orWhereExists(
          db("contacts")
            .select(1)
            .whereRaw("contacts.id = conversations.contact_id")
            .where((q2) => {
              q2.whereILike("name", s).orWhereILike("phone", s);
            })
        );
      });
    }

    const countRow = await base.clone().count<{ count: string }>("conversations.id as count").first();
    const rows = await base
      .clone()
      .leftJoin("contacts", "conversations.contact_id", "contacts.id")
      .select([
        "conversations.id",
        "conversations.contact_phone",
        "conversations.contact_id",
        "conversations.last_message_preview",
        "conversations.last_message_at",
        "conversations.unread_count",
        "conversations.status",
        "contacts.name as contact_name",
        "contacts.phone as contact_phone_e164",
        "contacts.tags as contact_tags"
      ])
      .orderBy("conversations.last_message_at", "desc")
      .orderBy("conversations.updated_at", "desc")
      .limit(input.limit)
      .offset(offset);

    return { rows, total: Number(countRow?.count ?? 0) };
  }

  async listMessages(input: {
    orgId: string;
    conversationId: string;
    page: number;
    limit: number;
  }): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
    const offset = (input.page - 1) * input.limit;
    const base = db("inbox_messages").where({ org_id: input.orgId, conversation_id: input.conversationId });
    const countRow = await base.clone().count<{ count: string }>("id as count").first();
    const rows = await base.clone().select("*").orderBy("created_at", "desc").limit(input.limit).offset(offset);
    return { rows: rows.reverse(), total: Number(countRow?.count ?? 0) };
  }

  async getConversation(input: { orgId: string; id: string }): Promise<Record<string, unknown> | null> {
    return db("conversations")
      .leftJoin("contacts", "conversations.contact_id", "contacts.id")
      .where({ "conversations.org_id": input.orgId, "conversations.id": input.id })
      .select([
        "conversations.id",
        "conversations.contact_phone",
        "conversations.contact_id",
        "conversations.last_message_preview",
        "conversations.last_message_at",
        "conversations.unread_count",
        "conversations.status",
        "contacts.name as contact_name",
        "contacts.phone as contact_phone_e164",
        "contacts.tags as contact_tags"
      ])
      .first();
  }

  async updateConversation(input: {
    orgId: string;
    id: string;
    status?: "open" | "resolved";
    clearUnread?: boolean;
  }): Promise<Record<string, unknown> | null> {
    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (input.status) patch.status = input.status;
    if (input.clearUnread) patch.unread_count = 0;
    const rows = await db("conversations").where({ org_id: input.orgId, id: input.id }).update(patch).returning("*");
    return rows[0] ?? null;
  }
}
