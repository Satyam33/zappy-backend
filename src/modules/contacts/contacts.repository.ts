import { db } from "../../config/database";

export type ContactRecord = {
  id: string;
  org_id: string;
  name: string | null;
  phone: string;
  tags: string[] | null;
  opted_in: boolean;
  created_at: string;
};

type ListFilters = {
  orgId: string;
  page: number;
  limit: number;
  search?: string;
  tag?: string;
  optedIn?: boolean;
};

export class ContactsRepository {
  async findAll(filters: ListFilters): Promise<{ rows: ContactRecord[]; total: number }> {
    const { orgId, page, limit, search, tag, optedIn } = filters;
    const offset = (page - 1) * limit;

    const baseQuery = db("contacts").where({ org_id: orgId });

    if (typeof optedIn === "boolean") {
      baseQuery.andWhere({ opted_in: optedIn });
    }

    if (search) {
      baseQuery.andWhere((qb) => {
        qb.whereILike("name", `%${search}%`).orWhereILike("phone", `%${search}%`);
      });
    }

    if (tag) {
      baseQuery.andWhereRaw("? = ANY(tags)", [tag]);
    }

    const countRow = await baseQuery.clone().count<{ count: string }>("id as count").first();
    const rows = await baseQuery
      .clone()
      .select(["id", "org_id", "name", "phone", "tags", "opted_in", "created_at"])
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset);

    return { rows, total: Number(countRow?.count ?? 0) };
  }

  async create(input: {
    orgId: string;
    name: string;
    phone: string;
    tags: string[];
    optedIn: boolean;
  }): Promise<ContactRecord> {
    const [row] = await db("contacts")
      .insert({
        org_id: input.orgId,
        name: input.name,
        phone: input.phone,
        tags: input.tags,
        opted_in: input.optedIn,
        opted_out_at: input.optedIn ? null : new Date()
      })
      .returning(["id", "org_id", "name", "phone", "tags", "opted_in", "created_at"]);
    return row;
  }

  async update(input: {
    orgId: string;
    id: string;
    name?: string;
    phone?: string;
    tags?: string[];
    optedIn?: boolean;
  }): Promise<ContactRecord | null> {
    const patch: Record<string, unknown> = {};
    if (typeof input.name === "string") patch.name = input.name;
    if (typeof input.phone === "string") patch.phone = input.phone;
    if (Array.isArray(input.tags)) patch.tags = input.tags;
    if (typeof input.optedIn === "boolean") {
      patch.opted_in = input.optedIn;
      patch.opted_out_at = input.optedIn ? null : new Date();
    }

    const [row] = await db("contacts")
      .where({ org_id: input.orgId, id: input.id })
      .update(patch)
      .returning(["id", "org_id", "name", "phone", "tags", "opted_in", "created_at"]);
    return row ?? null;
  }

  async delete(input: { orgId: string; id: string }): Promise<number> {
    return db("contacts").where({ org_id: input.orgId, id: input.id }).delete();
  }

  async bulkDelete(input: { orgId: string; ids: string[] }): Promise<number> {
    return db("contacts").where({ org_id: input.orgId }).whereIn("id", input.ids).delete();
  }
}
