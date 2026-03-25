import type { Request, Response } from "express";
import { SettingsService } from "./settings.service";

const service = new SettingsService();

export class SettingsController {
  async whatsapp(_req: Request, res: Response): Promise<void> {
    const data = await service.whatsappSettings();
    res.status(200).json({ data });
  }
}

export const settingsController = new SettingsController();
