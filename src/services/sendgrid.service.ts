export class SendgridService {
  async sendTransactionalEmail(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
