type WhatsAppConnectionStatus = {
  connected: boolean;
  qualityRating: string | null;
  messagingLimit: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  statusMessage: string;
};

export class WhatsAppService {
  private readonly graphBaseUrl = "https://graph.facebook.com/v22.0";

  async sendTemplate(): Promise<{ ok: boolean }> {
    return { ok: true };
  }

  async getConnectionStatus(input: {
    accessToken: string;
    phoneNumberId: string;
  }): Promise<WhatsAppConnectionStatus> {
    const { accessToken, phoneNumberId } = input;

    const url = new URL(`${this.graphBaseUrl}/${encodeURIComponent(phoneNumberId)}`);
    url.searchParams.set(
      "fields",
      "verified_name,quality_rating,display_phone_number"
    );
    url.searchParams.set("access_token", accessToken);
        console.log("WhatsApp API status check url:", url.toString());
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    
    const json = (await response.json()) as {
      verified_name?: string;
      quality_rating?: string;
      messaging_limit?: string;
      display_phone_number?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw Object.assign(new Error(json.error?.message || "Meta API status check failed"), {
        status: 502,
        code: "WHATSAPP_STATUS_CHECK_FAILED"
      });
    }

    return {
      connected: true,
      qualityRating: json.quality_rating ?? null,
      messagingLimit: json.messaging_limit ?? null,
      displayPhoneNumber: json.display_phone_number ?? null,
      verifiedName: json.verified_name ?? null,
      statusMessage: "WhatsApp API connected"
    };
  }
}
