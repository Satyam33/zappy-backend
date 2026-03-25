import type { Request, Response } from "express";
import { CampaignsService } from "./campaigns.service";

const service = new CampaignsService();

export class CampaignsController {
  async list(_req: Request, res: Response): Promise<void> {
    const campaigns = await service.list();
    res.status(200).json({ data: campaigns });
  }
}

export const campaignsController = new CampaignsController();
