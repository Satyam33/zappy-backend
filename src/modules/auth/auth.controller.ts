import type { Request, Response } from "express";
import { ZodError } from "zod";
import { AuthService } from "./auth.service";

const service = new AuthService();
type AppError = Error & { status?: number };

type ApiSuccess<T> = {
  success: true;
  code: number;
  message: string;
  data: T;
};

type ApiError = {
  success: false;
  code: number;
  message: string;
};

export class AuthController {
  private sendSuccess<T>(res: Response, code: number, message: string, data: T): void {
    const payload: ApiSuccess<T> = { success: true, code, message, data };
    res.status(code).json(payload);
  }

  private sendError(res: Response, err: unknown): void {
    if (err instanceof ZodError) {
      const payload: ApiError = {
        success: false,
        code: 400,
        message: err.issues[0]?.message || "Invalid request payload"
      };
      res.status(400).json(payload);
      return;
    }

    const appError = err as AppError;
    const status = appError.status ?? 500;
    const payload: ApiError = {
      success: false,
      code: status,
      message: appError.message || "Something went wrong"
    };
    res.status(status).json(payload);
  }

  async requestSignupOtp(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.requestSignupOtp(req.body);
      this.sendSuccess(res, 200, "Signup OTP sent successfully", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async verifySignupOtp(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.verifySignupOtp(req.body);
      this.sendSuccess(res, 200, "OTP verified successfully", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async signup(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.signup(req.body);
      this.sendSuccess(res, 201, "Signup successful", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.login(req.body);
      this.sendSuccess(res, 200, "Login successful", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.refresh(req.body);
      this.sendSuccess(res, 200, "Token refreshed successfully", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.logout(req.body);
      this.sendSuccess(res, 200, "Logout successful", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.forgotPassword(req.body);
      this.sendSuccess(res, 200, "Password reset instructions sent", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const data = await service.resetPassword(req.body);
      this.sendSuccess(res, 200, "Password reset successful", data);
    } catch (err) {
      this.sendError(res, err);
    }
  }
}

export const authController = new AuthController();
