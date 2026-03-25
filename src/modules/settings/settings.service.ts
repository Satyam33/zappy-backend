export class SettingsService {
  async whatsappSettings(): Promise<Record<string, unknown>> {
    return { qualityRating: "GREEN", messagingLimit: "TIER_1" };
  }
}
