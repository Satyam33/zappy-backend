export class AnalyticsService {
  async summary(): Promise<Record<string, unknown>> {
    return { range: "7d", messages: 0, campaigns: 0 };
  }
}
