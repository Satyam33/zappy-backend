import { TemplatesRepository } from "./templates.repository";
import { z } from "zod";
import { db } from "../../config/database";
import { WhatsAppService } from "../../services/whatsapp.service";

const repository = new TemplatesRepository();
const PREDEFINED_TEMPLATES: Array<Record<string, unknown>> = [
  {
    id: "predef-1",
    org_id: null,
    is_predefined: true,
    name: "welcome_offer_holi",
    category: "marketing",
    language: "en",
    template_type: "TEXT",
    body: "Hi {{1}}, celebrate Holi with {{2}}% off on your first order.",
    status: "approved",
    interactive_mode: "cta",
    interactive_actions: [{ type: "URL", title: "Shop Now", value: "https://example.com" }],
    sample_values: { "1": "Shivani", "2": "25" },
    variables: ["1", "2"],
    created_at: new Date().toISOString()
  },
  {
    id: "predef-2",
    org_id: null,
    is_predefined: true,
    name: "payment_reminder",
    category: "utility",
    language: "en",
    template_type: "TEXT",
    body: "Hi {{1}}, your payment of {{2}} is due on {{3}}.",
    status: "approved",
    interactive_mode: "quick_replies",
    interactive_actions: [{ type: "QUICK_REPLY", title: "Pay Now" }, { type: "QUICK_REPLY", title: "Need Help" }],
    sample_values: { "1": "Rahul", "2": "INR 999", "3": "20 Mar" },
    variables: ["1", "2", "3"],
    created_at: new Date().toISOString()
  }
];

const ListTemplatesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(12),
  status: z.enum(["draft", "pending", "approved", "action_required"]).optional(),
  source: z.enum(["predefined", "custom"]).optional(),
  search: z.string().optional()
});

const TemplateTypeEnum = z.enum([
  "TEXT",
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
  "LOCATION",
  "CAROUSEL",
  "LIMITED_TIME_OFFER"
]);

const ActionModeEnum = z.enum(["none", "cta", "quick_replies", "all"]);

const CreateTemplateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["marketing", "utility", "authentication"]),
  language: z.string().min(1),
  templateType: TemplateTypeEnum,
  body: z.string().min(1),
  sampleValues: z.record(z.string(), z.string()).default({}),
  interactiveMode: ActionModeEnum.default("none"),
  interactiveActions: z.array(z.object({
    type: z.enum(["URL", "PHONE", "QUICK_REPLY", "COPY_CODE"]),
    title: z.string().min(1),
    value: z.string().optional()
  })).default([]),
  submitAs: z.enum(["draft", "pending"]).default("pending")
});

export class TemplatesService {
  private readonly whatsappService = new WhatsAppService();

  private normalizeTemplate(row: Record<string, unknown>): Record<string, unknown> {
    const interactiveActions = row.interactive_actions;
    const sampleValues = row.sample_values;
    return {
      ...row,
      interactive_actions:
        typeof interactiveActions === "string"
          ? JSON.parse(interactiveActions)
          : (interactiveActions ?? []),
      sample_values:
        typeof sampleValues === "string"
          ? JSON.parse(sampleValues)
          : (sampleValues ?? {}),
      variables: Array.isArray(row.variables) ? row.variables : []
    };
  }

  private extractVariables(body: string): string[] {
    const matches = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]);
    return Array.from(new Set(matches)).sort((a, b) => Number(a) - Number(b));
  }

  private mapMetaStatus(status?: string): "draft" | "pending" | "approved" | "action_required" {
    const value = String(status || "").toLowerCase();
    if (value === "approved") return "approved";
    if (value === "rejected" || value === "paused" || value === "disabled") return "action_required";
    if (value === "draft") return "draft";
    return "pending";
  }

  private async getOrgMetaConfig(orgId: string): Promise<{ wabaId: string; accessToken: string }> {
    const org = await db("organizations")
      .where({ id: orgId })
      .select(["waba_id", "access_token"])
      .first();
    if (!org?.waba_id || !org?.access_token) {
      throw Object.assign(new Error("WhatsApp API is not configured for this org"), { status: 400 });
    }
    return { wabaId: String(org.waba_id), accessToken: String(org.access_token) };
  }

  async list(input: { orgId: string; query: unknown }): Promise<Record<string, unknown>> {
    const query = ListTemplatesSchema.parse(input.query);
    if (query.source === "predefined") {
      let list = PREDEFINED_TEMPLATES;
      if (query.status) list = list.filter((t) => t.status === query.status);
      if (query.search) {
        const s = query.search.toLowerCase();
        list = list.filter(
          (t) =>
            String(t.name).toLowerCase().includes(s) ||
            String(t.body).toLowerCase().includes(s)
        );
      }
      const total = list.length;
      const offset = (query.page - 1) * query.limit;
      const items = list.slice(offset, offset + query.limit).map((row) => this.normalizeTemplate(row));
      return {
        items,
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.max(1, Math.ceil(total / query.limit))
      };
    }

    const { rows, total } = await repository.findAll({
      orgId: input.orgId,
      page: query.page,
      limit: query.limit,
      status: query.status,
      source: "custom",
      search: query.search?.trim() || undefined
    });
    return {
      items: rows.map((row) => this.normalizeTemplate(row)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit))
    };
  }

  async create(input: { orgId: string; body: unknown }): Promise<Record<string, unknown>> {
    const payload = CreateTemplateSchema.parse(input.body);
    const variables = this.extractVariables(payload.body);
    let mappedStatus: "draft" | "pending" | "approved" | "action_required" = payload.submitAs;
    let metaTemplateId: string | undefined;
    let rejectionReason: string | undefined;
    if (payload.submitAs === "pending") {
      const cfg = await this.getOrgMetaConfig(input.orgId);
      const metaResult = await this.whatsappService.submitTemplateForApproval({
        wabaId: cfg.wabaId,
        accessToken: cfg.accessToken,
        name: payload.name,
        language: payload.language,
        category: payload.category,
        body: payload.body,
        sampleValues: payload.sampleValues,
        interactiveActions: payload.interactiveActions
      });
      mappedStatus = this.mapMetaStatus(metaResult.status);
      metaTemplateId = metaResult.id;
      if (mappedStatus === "action_required") {
        rejectionReason = "Template requires action in Meta"
      }
    }

    const created = await repository.create({
      org_id: input.orgId,
      is_predefined: false,
      name: payload.name,
      category: payload.category,
      language: payload.language,
      template_type: payload.templateType,
      body: payload.body,
      status: mappedStatus,
      meta_template_id: metaTemplateId ?? null,
      interactive_mode: payload.interactiveMode,
      interactive_actions: JSON.stringify(payload.interactiveActions),
      sample_values: JSON.stringify(payload.sampleValues),
      variables,
      rejection_reason: rejectionReason ?? null
    });
    return this.normalizeTemplate(created);
  }

  async update(input: { orgId: string; id: string; body: unknown }): Promise<Record<string, unknown>> {
    const payload = CreateTemplateSchema.partial().parse(input.body);
    const patch: Record<string, unknown> = {};
    if (payload.name) patch.name = payload.name;
    if (payload.category) patch.category = payload.category;
    if (payload.language) patch.language = payload.language;
    if (payload.templateType) patch.template_type = payload.templateType;
    if (payload.body) {
      patch.body = payload.body;
      patch.variables = this.extractVariables(payload.body);
    }
    if (payload.submitAs) patch.status = payload.submitAs;
    if (payload.interactiveMode) patch.interactive_mode = payload.interactiveMode;
    if (payload.interactiveActions) patch.interactive_actions = JSON.stringify(payload.interactiveActions);
    if (payload.sampleValues) patch.sample_values = JSON.stringify(payload.sampleValues);

    const updated = await repository.update({ orgId: input.orgId, id: input.id, patch });
    if (!updated) throw Object.assign(new Error("Template not found"), { status: 404 });
    return this.normalizeTemplate(updated);
  }

  async syncStatus(input: { orgId: string; templateId?: string }): Promise<{ updated: number }> {
    const templates = await repository.findForSync({ orgId: input.orgId, id: input.templateId });
    if (!templates.length) return { updated: 0 };
    const cfg = await this.getOrgMetaConfig(input.orgId);
    const names = templates.map((t) => String(t.name));
    const statuses = await this.whatsappService.fetchTemplatesStatus({
      wabaId: cfg.wabaId,
      accessToken: cfg.accessToken,
      names
    });

    let updatedCount = 0;
    for (const template of templates) {
      const matched = statuses.find((s) =>
        (s.id && template.meta_template_id && s.id === template.meta_template_id) ||
        (s.name && s.name === template.name)
      );
      if (!matched) continue;
      const nextStatus = this.mapMetaStatus(matched.status);
      const updated = await repository.updateByMetaOrName({
        orgId: input.orgId,
        metaTemplateId: matched.id || (typeof template.meta_template_id === "string" ? template.meta_template_id : undefined),
        name: matched.name || String(template.name),
        patch: {
          status: nextStatus,
          meta_template_id: matched.id || template.meta_template_id || null,
          rejection_reason: matched.rejected_reason || null
        }
      });
      updatedCount += updated;
    }
    return { updated: updatedCount };
  }

  async handleWebhookTemplateStatus(input: {
    orgId: string;
    metaTemplateId?: string;
    templateName?: string;
    status?: string;
    rejectionReason?: string;
  }): Promise<void> {
    const nextStatus = this.mapMetaStatus(input.status);
    await repository.updateByMetaOrName({
      orgId: input.orgId,
      metaTemplateId: input.metaTemplateId,
      name: input.templateName,
      patch: {
        status: nextStatus,
        rejection_reason: input.rejectionReason || null
      }
    });
  }
}
