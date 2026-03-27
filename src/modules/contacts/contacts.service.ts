import { ContactsRepository } from "./contacts.repository";
import { z } from "zod";

const repository = new ContactsRepository();

const ListContactsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  tag: z.string().optional(),
  opted_in: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true"))
});

const CreateContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Phone must be valid E.164 format"),
  tags: z.array(z.string()).default([]),
  opted_in: z.boolean().optional().default(true)
});

const UpdateContactSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  tags: z.array(z.string()).optional(),
  opted_in: z.boolean().optional()
});

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Select at least one contact")
});

export class ContactsService {
  async list(input: { orgId: string; query: unknown }): Promise<{
    items: Array<{
      id: string;
      name: string;
      phone: string;
      tags: string[];
      opted_in: boolean;
      createdAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query = ListContactsSchema.parse(input.query);
    const { rows, total } = await repository.findAll({
      orgId: input.orgId,
      page: query.page,
      limit: query.limit,
      search: query.search?.trim() || undefined,
      tag: query.tag?.trim() || undefined,
      optedIn: query.opted_in
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name ?? "",
        phone: row.phone,
        tags: row.tags ?? [],
        opted_in: row.opted_in,
        createdAt: new Date(row.created_at).toISOString()
      })),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit))
    };
  }

  async create(input: { orgId: string; body: unknown }): Promise<{
    id: string;
    name: string;
    phone: string;
    tags: string[];
    opted_in: boolean;
    createdAt: string;
  }> {
    const payload = CreateContactSchema.parse(input.body);
    const row = await repository.create({
      orgId: input.orgId,
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      tags: payload.tags,
      optedIn: payload.opted_in
    });
    return {
      id: row.id,
      name: row.name ?? "",
      phone: row.phone,
      tags: row.tags ?? [],
      opted_in: row.opted_in,
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  async update(input: { orgId: string; id: string; body: unknown }): Promise<{
    id: string;
    name: string;
    phone: string;
    tags: string[];
    opted_in: boolean;
    createdAt: string;
  }> {
    const payload = UpdateContactSchema.parse(input.body);
    const updated = await repository.update({
      orgId: input.orgId,
      id: input.id,
      name: payload.name?.trim(),
      phone: payload.phone?.trim(),
      tags: payload.tags,
      optedIn: payload.opted_in
    });

    if (!updated) {
      throw Object.assign(new Error("Contact not found"), { status: 404 });
    }

    return {
      id: updated.id,
      name: updated.name ?? "",
      phone: updated.phone,
      tags: updated.tags ?? [],
      opted_in: updated.opted_in,
      createdAt: new Date(updated.created_at).toISOString()
    };
  }

  async delete(input: { orgId: string; id: string }): Promise<{ deleted: number }> {
    const deleted = await repository.delete(input);
    if (!deleted) {
      throw Object.assign(new Error("Contact not found"), { status: 404 });
    }
    return { deleted };
  }

  async bulkDelete(input: { orgId: string; body: unknown }): Promise<{ deleted: number }> {
    const payload = BulkDeleteSchema.parse(input.body);
    const deleted = await repository.bulkDelete({ orgId: input.orgId, ids: payload.ids });
    return { deleted };
  }
}
