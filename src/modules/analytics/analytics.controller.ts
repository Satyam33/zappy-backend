import type { Request, Response } from "express";
import { AnalyticsService } from "./analytics.service";

const service = new AnalyticsService();

export class AnalyticsController {
  async summary(_req: Request, res: Response): Promise<void> {
    const data = await service.summary();
    res.status(200).json({ data });
  }
}

export const analyticsController = new AnalyticsController();
