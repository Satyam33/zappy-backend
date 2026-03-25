import type { Request, Response } from "express";
import { ContactsService } from "./contacts.service";

const service = new ContactsService();

export class ContactsController {
  async list(_req: Request, res: Response): Promise<void> {
    const contacts = await service.list();
    res.status(200).json({ data: contacts });
  }
}

export const contactsController = new ContactsController();
