import { CampaignsRepository } from "./campaigns.repository";
import { z } from "zod";
import { db } from "../../config/database";
import { WhatsAppService } from "../../services/whatsapp.service";

const repository = new CampaignsRepository();
const whatsappService = new WhatsAppService();

const AudienceSchema = z.union([
  z.object({ mode: z.literal("all") }),
  z.object({ mode: z.literal("tag"), tag: z.string().min(1) }),
  z.object({ mode: z.literal("ids"), ids: z.array(z.string().uuid()).min(1) })
]);

const CreateCampaignSchema = z.object({
  name: z.string().min(1),
  templateId: z.string().uuid(),
  audience: AudienceSchema,
  parameterMapping: z.record(z.string(), z.string()).default({}),
  scheduleNow: z.boolean().default(true),
  scheduledAt: z.string().optional()
});

export class CampaignsService {
  private normalizeCampaign(row: Record<string, unknown>): Record<string, unknown> {
    return {
      id: row.id,
      name: row.name,
      templateId: row.template_id,
      templateName: row.template_name,
      status: row.status,
      audienceMode: row.audience_mode,
      audienceTag: row.audience_tag,
      selectedAudience: row.selected_audience,
      finalAudience: row.final_audience,
      parameterMapping:
        typeof row.parameter_mapping === "string" ? JSON.parse(row.parameter_mapping) : (row.parameter_mapping ?? {}),
      stats: typeof row.stats === "string" ? JSON.parse(row.stats) : (row.stats ?? {}),
      scheduledAt: row.scheduled_at ? new Date(String(row.scheduled_at)).toISOString() : null,
      sentAt: row.sent_at ? new Date(String(row.sent_at)).toISOString() : null,
      createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null
    };
  }

  private resolveParamValue(source: string, contact: { name: string | null; phone: string }): string {
    if (source === "contact.name") return (contact.name || "").trim();
    if (source === "contact.phone" || source === "contact.mobile") return contact.phone;
    return source;
  }

  private async getOrgChannelConfig(orgId: string): Promise<{ phoneNumberId: string; accessToken: string }> {
    const org = await db("organizations")
      .where({ id: orgId })
      .select(["phone_number_id", "access_token"])
      .first();
    if (!org?.phone_number_id || !org?.access_token) {
      throw Object.assign(new Error("WhatsApp API is not configured for this org"), { status: 400 });
    }
    return { phoneNumberId: String(org.phone_number_id), accessToken: String(org.access_token) };
  }

  async list(input: { orgId: string }): Promise<Array<Record<string, unknown>>> {
    const rows = await repository.findAll({ orgId: input.orgId });
    return rows.map((row) => this.normalizeCampaign(row));
  }

  async meta(input: { orgId: string }): Promise<Record<string, unknown>> {
    const [templates, totalAudience, org] = await Promise.all([
      repository.findApprovedTemplates({ orgId: input.orgId }),
      repository.countAudience({ orgId: input.orgId, audience: { mode: "all" } }),
      db("organizations")
        .where({ id: input.orgId })
        .select(["quality_rating", "messaging_limit"])
        .first()
    ]);

    const tagsRows = await db("contacts")
      .where({ org_id: input.orgId })
      .whereNotNull("tags")
      .select("tags");
    const tags = Array.from(
      new Set(
        tagsRows.flatMap((row: { tags?: unknown }) =>
          Array.isArray(row.tags) ? row.tags.map((t: unknown) => String(t).trim()).filter(Boolean) : []
        )
      )
    );

    return {
      qualityRating: org?.quality_rating ?? "UNKNOWN",
      messagingTier: org?.messaging_limit ?? "TIER_1",
      remainingQuota: 1000,
      selectedAudience: 0,
      finalAudience: 0,
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        language: t.language,
        body: t.body,
        variables: Array.isArray(t.variables) ? t.variables : [],
        templateType: t.template_type
      })),
      segments: [
        { key: "all", label: "All", count: totalAudience },
        ...tags.map((tag) => ({ key: `tag:${tag}`, label: tag }))
      ],
      dynamicAttributes: [
        { key: "contact.name", label: "Customer Name" },
        { key: "contact.phone", label: "Mobile Number" }
      ]
    };
  }

  async previewAudience(input: { orgId: string; body: unknown }): Promise<{ selectedAudience: number; finalAudience: number }> {
    const payload = z.object({ audience: AudienceSchema }).parse(input.body);
    const count = await repository.countAudience({ orgId: input.orgId, audience: payload.audience });
    return { selectedAudience: count, finalAudience: count };
  }

  async create(input: { orgId: string; body: unknown }): Promise<Record<string, unknown>> {
    const payload = CreateCampaignSchema.parse(input.body);
    const template = await repository.findTemplateForSend({ orgId: input.orgId, templateId: payload.templateId });
    if (!template) {
      throw Object.assign(new Error("Approved template not found"), { status: 404 });
    }
    const contacts = await repository.findAudienceContacts({ orgId: input.orgId, audience: payload.audience });
    const selectedAudience = contacts.length;
    const created = await repository.create({
      org_id: input.orgId,
      name: payload.name.trim(),
      template_id: payload.templateId,
      template_name: template.name,
      status: payload.scheduleNow ? "running" : "scheduled",
      audience_mode: payload.audience.mode,
      audience_tag: payload.audience.mode === "tag" ? payload.audience.tag : null,
      audience_contact_ids: payload.audience.mode === "ids" ? payload.audience.ids : [],
      selected_audience: selectedAudience,
      final_audience: selectedAudience,
      parameter_mapping: JSON.stringify(payload.parameterMapping),
      scheduled_at: payload.scheduleNow ? null : payload.scheduledAt ? new Date(payload.scheduledAt) : null,
      sent_at: payload.scheduleNow ? new Date() : null,
      stats: JSON.stringify({ sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 })
    });

    if (!payload.scheduleNow) return this.normalizeCampaign(created);

    const cfg = await this.getOrgChannelConfig(input.orgId);
    const variables = Array.isArray(template.variables) ? template.variables.map((v) => String(v)) : [];
    let sent = 0;
    let failed = 0;

    for (const contact of contacts) {
      try {
        const bodyParameters = variables.map((v) =>
          this.resolveParamValue(payload.parameterMapping[v] || "", contact)
        );
        await whatsappService.sendTemplateMessage({
          accessToken: cfg.accessToken,
          phoneNumberId: cfg.phoneNumberId,
          to: contact.phone,
          templateName: String(template.name),
          language: String(template.language || "en"),
          bodyParameters
        });
        sent += 1;
      } catch {
        failed += 1;
      }
    }

    const done = await repository.update({
      orgId: input.orgId,
      id: String(created.id),
      patch: {
        status: "completed",
        stats: JSON.stringify({ sent, delivered: sent, read: 0, replied: 0, failed })
      }
    });
    return this.normalizeCampaign(done || created);
  }
}
