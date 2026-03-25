export class S3Service {
  async uploadCsv(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
