import { z } from "zod";
import { db } from "../../config/database";
import { WhatsAppService } from "../../services/whatsapp.service";

const UpdateWhatsAppSettingsSchema = z.object({
  phoneNumberId: z.string().min(1, "Phone Number ID is required"),
  wabaId: z.string().min(1, "WhatsApp Business Account ID is required"),
  accessToken: z.string().min(10, "Access token is required")
});

const UpdateBusinessProfileSchema = z.object({
  category: z.string().min(1, "Category is required"),
  timezone: z.string().min(1, "Timezone is required"),
  optOutKeyword: z.string().min(1, "Opt-out keyword is required")
});

const UpdateWebhookSettingsSchema = z.object({
  events: z.object({
    messages: z.boolean(),
    message_status: z.boolean(),
    template_status: z.boolean()
  })
});

type WhatsAppSettingsData = {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  qualityRating: string;
  messagingLimit: string;
};

type WhatsAppStatusData = {
  connected: boolean;
  qualityRating: string | null;
  messagingLimit: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  statusMessage: string;
};

type BusinessProfileData = {
  businessName: string;
  displayPhone: string;
  category: string;
  timezone: string;
  optOutKeyword: string;
};

type WebhookEvents = {
  messages: boolean;
  message_status: boolean;
  template_status: boolean;
};

type WebhookSettingsData = {
  webhookUrl: string;
  verifyToken: string;
  events: WebhookEvents;
};

export class SettingsService {
  private readonly whatsappService = new WhatsAppService();
  private readonly defaultWebhookEvents: WebhookEvents = {
    messages: true,
    message_status: true,
    template_status: false
  };

  private async getOrganization(orgId: string): Promise<{
    id: string;
    name: string;
    waba_id: string | null;
    phone_number_id: string | null;
    access_token: string | null;
    quality_rating: string;
    messaging_limit: string;
    timezone: string;
    opt_out_keyword: string;
    category: string | null;
    webhook_events: unknown;
  }> {
    const organization = await db("organizations")
      .where({ id: orgId })
      .select([
        "id",
        "name",
        "waba_id",
        "phone_number_id",
        "access_token",
        "quality_rating",
        "messaging_limit",
        "timezone",
        "opt_out_keyword",
        "category",
        "webhook_events"
      ])
      .first();

    if (!organization) {
      throw Object.assign(new Error("Organization not found"), {
        status: 404,
        code: "ORG_NOT_FOUND"
      });
    }

    return organization;
  }

  async whatsappSettings(orgId: string): Promise<WhatsAppSettingsData> {
    const organization = await this.getOrganization(orgId);

    return {
      phoneNumberId: organization.phone_number_id ?? "",
      wabaId: organization.waba_id ?? "",
      accessToken: organization.access_token ?? "",
      qualityRating: organization.quality_rating ?? "UNKNOWN",
      messagingLimit: organization.messaging_limit ?? "UNKNOWN"
    };
  }

  async updateWhatsappSettings(
    orgId: string,
    input: unknown
  ): Promise<WhatsAppSettingsData> {
    const payload = UpdateWhatsAppSettingsSchema.parse(input);

    await this.getOrganization(orgId);

    await db("organizations")
      .where({ id: orgId })
      .update({
        phone_number_id: payload.phoneNumberId.trim(),
        waba_id: payload.wabaId.trim(),
        access_token: payload.accessToken.trim()
      });

    return this.whatsappSettings(orgId);
  }

  async whatsappConnectionStatus(orgId: string): Promise<WhatsAppStatusData> {
    const organization = await this.getOrganization(orgId);
    if (!organization.access_token || !organization.phone_number_id) {
      return {
        connected: false,
        qualityRating: organization.quality_rating ?? null,
        messagingLimit: organization.messaging_limit ?? null,
        displayPhoneNumber: null,
        verifiedName: null,
        statusMessage: "WhatsApp settings are not configured"
      };
    }

    const status = await this.whatsappService.getConnectionStatus({
      accessToken: organization.access_token,
      phoneNumberId: organization.phone_number_id
    });

    await db("organizations")
      .where({ id: orgId })
      .update({
        quality_rating: status.qualityRating ?? organization.quality_rating,
        messaging_limit: status.messagingLimit ?? organization.messaging_limit
      });

    return status;
  }

  async businessProfile(orgId: string): Promise<BusinessProfileData> {
    const organization = await this.getOrganization(orgId);
    let businessNameFromMeta = "";
    let displayPhoneFromMeta = "";
    
    if (organization.access_token && organization.phone_number_id) {
      try {
        const status = await this.whatsappService.getConnectionStatus({
          accessToken: organization.access_token,
          phoneNumberId: organization.phone_number_id
        });
        
        businessNameFromMeta = status.verifiedName ?? "";
        displayPhoneFromMeta = status.displayPhoneNumber ?? "";
      } catch {
        // Keep profile endpoint resilient even when Meta API is unavailable.
      }
    }

    return {
      businessName: businessNameFromMeta || organization.name,
      displayPhone: displayPhoneFromMeta,
      category: organization.category ?? "Other",
      timezone: organization.timezone ?? "Asia/Kolkata",
      optOutKeyword: organization.opt_out_keyword ?? "STOP"
    };
  }

  async updateBusinessProfile(orgId: string, input: unknown): Promise<BusinessProfileData> {
    const payload = UpdateBusinessProfileSchema.parse(input);

    await this.getOrganization(orgId);

    await db("organizations")
      .where({ id: orgId })
      .update({
        category: payload.category.trim(),
        timezone: payload.timezone.trim(),
        opt_out_keyword: payload.optOutKeyword.trim()
      });

    return this.businessProfile(orgId);
  }

  private normalizeWebhookEvents(raw: unknown): WebhookEvents {
    if (!raw || typeof raw !== "object") return this.defaultWebhookEvents;
    const value = raw as Partial<WebhookEvents>;
    return {
      messages: Boolean(value.messages),
      message_status: Boolean(value.message_status),
      template_status: Boolean(value.template_status)
    };
  }

  async webhookSettings(input: {
    orgId: string;
    webhookUrl: string;
    verifyToken: string;
  }): Promise<WebhookSettingsData> {
    const organization = await this.getOrganization(input.orgId);
    return {
      webhookUrl: input.webhookUrl,
      verifyToken: input.verifyToken,
      events: this.normalizeWebhookEvents(organization.webhook_events)
    };
  }

  async updateWebhookSettings(
    orgId: string,
    input: unknown,
    readonlyData: { webhookUrl: string; verifyToken: string }
  ): Promise<WebhookSettingsData> {
    const payload = UpdateWebhookSettingsSchema.parse(input);
    await this.getOrganization(orgId);

    await db("organizations")
      .where({ id: orgId })
      .update({ webhook_events: JSON.stringify(payload.events) });

    return this.webhookSettings({
      orgId,
      webhookUrl: readonlyData.webhookUrl,
      verifyToken: readonlyData.verifyToken
    });
  }
}
