import { Router } from "express";
import { authController } from "./auth.controller";

export const authRoutes = Router();

authRoutes.post("/send-otp", (req, res) => {
  void authController.requestSignupOtp(req, res);
});
authRoutes.post("/verify-otp", (req, res) => {
  void authController.verifySignupOtp(req, res);
});
authRoutes.post("/signup", (req, res) => {
  void authController.signup(req, res);
});
authRoutes.post("/login", (req, res) => {
  void authController.login(req, res);
});
authRoutes.post("/refresh", (req, res) => {
  void authController.refresh(req, res);
});
authRoutes.post("/logout", (req, res) => {
  void authController.logout(req, res);
});
authRoutes.post("/forgot-password", (req, res) => {
  void authController.forgotPassword(req, res);
});
authRoutes.post("/reset-password", (req, res) => {
  void authController.resetPassword(req, res);
});
