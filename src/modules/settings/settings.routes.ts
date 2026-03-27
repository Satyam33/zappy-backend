import { Router } from "express";
import { settingsController } from "./settings.controller";

export const settingsRoutes = Router();

settingsRoutes.get("/whatsapp", (req, res) => {
  void settingsController.whatsapp(req, res);
});

settingsRoutes.put("/whatsapp", (req, res) => {
  void settingsController.updateWhatsapp(req, res);
});

settingsRoutes.get("/whatsapp/status", (req, res) => {
  void settingsController.whatsappStatus(req, res);
});

settingsRoutes.get("/profile", (req, res) => {
  void settingsController.profile(req, res);
});

settingsRoutes.put("/profile", (req, res) => {
  void settingsController.updateProfile(req, res);
});

settingsRoutes.get("/webhook", (req, res) => {
  void settingsController.webhook(req, res);
});

settingsRoutes.put("/webhook", (req, res) => {
  void settingsController.updateWebhook(req, res);
});
