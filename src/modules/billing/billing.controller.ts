import type { Request, Response } from "express";
import { BillingService } from "./billing.service";

const service = new BillingService();

export class BillingController {
  async usage(_req: Request, res: Response): Promise<void> {
    const data = await service.usage();
    res.status(200).json({ data });
  }
}

export const billingController = new BillingController();
