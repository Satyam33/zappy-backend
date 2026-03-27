import { Router } from "express";
import { campaignsController } from "./campaigns.controller";

export const campaignsRoutes = Router();

campaignsRoutes.get("/", (req, res) => {
  void campaignsController.list(req, res);
});

campaignsRoutes.get("/meta", (req, res) => {
  void campaignsController.meta(req, res);
});

campaignsRoutes.post("/preview-audience", (req, res) => {
  void campaignsController.previewAudience(req, res);
});

campaignsRoutes.post("/", (req, res) => {
  void campaignsController.create(req, res);
});
