import { db } from "../../config/database";

type ListFilters = {
  orgId: string;
  page: number;
  limit: number;
  status?: string;
  source?: "predefined" | "custom";
  search?: string;
};

export class TemplatesRepository {
  async findAll(filters: ListFilters): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
    const offset = (filters.page - 1) * filters.limit;
    const query = db("templates").where((qb) => {
      qb.where({ is_predefined: true }).orWhere({ org_id: filters.orgId });
    });

    if (filters.status) query.andWhere({ status: filters.status });
    if (filters.source === "predefined") query.andWhere({ is_predefined: true });
    if (filters.source === "custom") query.andWhere({ is_predefined: false, org_id: filters.orgId });
    if (filters.search) {
      query.andWhere((qb) => {
        qb.whereILike("name", `%${filters.search}%`).orWhereILike("body", `%${filters.search}%`);
      });
    }

    const countRow = await query.clone().count<{ count: string }>("id as count").first();
    const rows = await query
      .clone()
      .orderBy("created_at", "desc")
      .limit(filters.limit)
      .offset(offset);

    return { rows, total: Number(countRow?.count ?? 0) };
  }

  async create(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const [row] = await db("templates").insert(input).returning("*");
    return row;
  }

  async findCustomById(input: { orgId: string; id: string }): Promise<Record<string, unknown> | null> {
    return db("templates")
      .where({ id: input.id, org_id: input.orgId, is_predefined: false })
      .first();
  }

  async findForSync(input: { orgId: string; id?: string }): Promise<Array<Record<string, unknown>>> {
    const query = db("templates")
      .where({ org_id: input.orgId, is_predefined: false })
      .whereIn("status", ["pending", "action_required", "approved"]);
    if (input.id) query.andWhere({ id: input.id });
    return query.select("*");
  }

  async update(input: { orgId: string; id: string; patch: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
    const [row] = await db("templates")
      .where({ id: input.id, org_id: input.orgId, is_predefined: false })
      .update({ ...input.patch, updated_at: new Date() })
      .returning("*");
    return row ?? null;
  }

  async updateByMetaOrName(input: {
    orgId: string;
    metaTemplateId?: string;
    name?: string;
    patch: Record<string, unknown>;
  }): Promise<number> {
    if (!input.metaTemplateId && !input.name) return 0;
    const query = db("templates")
      .where({ org_id: input.orgId, is_predefined: false })
      .andWhere((qb) => {
        if (input.metaTemplateId) qb.orWhere({ meta_template_id: input.metaTemplateId });
        if (input.name) qb.orWhere({ name: input.name });
      });
    return query.update({ ...input.patch, updated_at: new Date() });
  }
}
