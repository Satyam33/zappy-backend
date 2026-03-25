export class BillingService {
  async usage(): Promise<Record<string, unknown>> {
    return { plan: "starter", messagesUsed: 0 };
  }
}
