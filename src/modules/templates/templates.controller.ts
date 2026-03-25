import type { Request, Response } from "express";
import { TemplatesService } from "./templates.service";

const service = new TemplatesService();

export class TemplatesController {
  async list(_req: Request, res: Response): Promise<void> {
    const templates = await service.list();
    res.status(200).json({ data: templates });
  }
}

export const templatesController = new TemplatesController();
