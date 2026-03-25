import { Router } from "express";
import { settingsController } from "./settings.controller";

export const settingsRoutes = Router();

settingsRoutes.get("/whatsapp", (req, res) => {
  void settingsController.whatsapp(req, res);
});
