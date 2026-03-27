import { z } from "zod";
import { db } from "../../config/database";
import { WhatsAppService } from "../../services/whatsapp.service";

const UpdateWhatsAppSettingsSchema = z.object({
  phoneNumberId: z.string().min(1, "Phone Number ID is required"),
  wabaId: z.string().min(1, "WhatsApp Business Account ID is required"),
  accessToken: z.string().min(10, "Access token is required")
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

export class SettingsService {
  private readonly whatsappService = new WhatsAppService();

  private async getOrganization(orgId: string): Promise<{
    id: string;
    waba_id: string | null;
    phone_number_id: string | null;
    access_token: string | null;
    quality_rating: string;
    messaging_limit: string;
  }> {
    const organization = await db("organizations")
      .where({ id: orgId })
      .select([
        "id",
        "waba_id",
        "phone_number_id",
        "access_token",
        "quality_rating",
        "messaging_limit"
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
}
