import { db } from "../../config/database";

type AudienceInput =
  | { mode: "all" }
  | { mode: "tag"; tag: string }
  | { mode: "ids"; ids: string[] };

export class CampaignsRepository {
  async findAll(input: {
    orgId: string;
    page: number;
    limit: number;
    search?: string;
  }): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
    const offset = (input.page - 1) * input.limit;
    const query = db("campaigns").where({ org_id: input.orgId });
    if (input.search) {
      query.andWhere((qb) => {
        qb.whereILike("name", `%${input.search}%`).orWhereILike("template_name", `%${input.search}%`);
      });
    }
    const countRow = await query.clone().count<{ count: string }>("id as count").first();
    const rows = await query
      .clone()
      .orderBy("created_at", "desc")
      .limit(input.limit)
      .offset(offset);
    return { rows, total: Number(countRow?.count ?? 0) };
  }

  async findApprovedTemplates(input: { orgId: string }): Promise<Array<Record<string, unknown>>> {
    return db("templates")
      .where({ org_id: input.orgId, is_predefined: false, status: "approved" })
      .orderBy("created_at", "desc");
  }

  async countAudience(input: { orgId: string; audience: AudienceInput }): Promise<number> {
    const query = db("contacts").where({ org_id: input.orgId, opted_in: true });
    if (input.audience.mode === "tag") query.andWhereRaw("? = ANY(tags)", [input.audience.tag]);
    if (input.audience.mode === "ids") query.whereIn("id", input.audience.ids);
    const row = await query.count<{ count: string }>("id as count").first();
    return Number(row?.count ?? 0);
  }

  async findAudienceContacts(input: {
    orgId: string;
    audience: AudienceInput;
  }): Promise<Array<{ id: string; name: string | null; phone: string }>> {
    const query = db("contacts")
      .where({ org_id: input.orgId, opted_in: true })
      .select(["id", "name", "phone"]);
    if (input.audience.mode === "tag") query.andWhereRaw("? = ANY(tags)", [input.audience.tag]);
    if (input.audience.mode === "ids") query.whereIn("id", input.audience.ids);
    return query.orderBy("created_at", "desc");
  }

  async create(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const [row] = await db("campaigns").insert(input).returning("*");
    return row;
  }

  async update(input: { orgId: string; id: string; patch: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
    const [row] = await db("campaigns")
      .where({ id: input.id, org_id: input.orgId })
      .update({ ...input.patch, updated_at: new Date() })
      .returning("*");
    return row ?? null;
  }

  async findTemplateForSend(input: { orgId: string; templateId: string }): Promise<Record<string, unknown> | null> {
    return db("templates")
      .where({ id: input.templateId, org_id: input.orgId, status: "approved", is_predefined: false })
      .first();
  }
}
