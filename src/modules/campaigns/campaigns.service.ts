import { CampaignsRepository } from "./campaigns.repository";

const repository = new CampaignsRepository();

export class CampaignsService {
  async list(): Promise<Array<Record<string, unknown>>> {
    return repository.findAll();
  }
}
