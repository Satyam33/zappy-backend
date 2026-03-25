import { InboxRepository } from "./inbox.repository";

const repository = new InboxRepository();

export class InboxService {
  async listConversations(): Promise<Array<Record<string, unknown>>> {
    return repository.findConversations();
  }
}
