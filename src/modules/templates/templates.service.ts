import { TemplatesRepository } from "./templates.repository";

const repository = new TemplatesRepository();

export class TemplatesService {
  async list(): Promise<Array<Record<string, unknown>>> {
    return repository.findAll();
  }
}
