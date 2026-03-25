import { ContactsRepository } from "./contacts.repository";

const repository = new ContactsRepository();

export class ContactsService {
  async list(): Promise<Array<Record<string, unknown>>> {
    return repository.findAll();
  }
}
