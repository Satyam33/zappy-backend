import type { Request, Response } from "express";
import { AuthService } from "./auth.service";

const service = new AuthService();

export class AuthController {
  async requestSignupOtp(req: Request, res: Response): Promise<void> {
    const data = await service.requestSignupOtp(req.body);
    res.status(200).json(data);
  }

  async verifySignupOtp(req: Request, res: Response): Promise<void> {
    const data = await service.verifySignupOtp(req.body);
    res.status(200).json(data);
  }

  async signup(req: Request, res: Response): Promise<void> {
    const data = await service.signup(req.body);
    res.status(201).json(data);
  }

  async login(req: Request, res: Response): Promise<void> {
    const data = await service.login(req.body);
    res.status(200).json(data);
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const data = await service.refresh(req.body);
    res.status(200).json(data);
  }

  async logout(req: Request, res: Response): Promise<void> {
    const data = await service.logout(req.body);
    res.status(200).json(data);
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const data = await service.forgotPassword(req.body);
    res.status(200).json(data);
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    const data = await service.resetPassword(req.body);
    res.status(200).json(data);
  }
}

export const authController = new AuthController();
