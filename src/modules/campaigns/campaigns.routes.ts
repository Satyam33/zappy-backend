import { Router } from "express";
import { campaignsController } from "./campaigns.controller";

export const campaignsRoutes = Router();

campaignsRoutes.get("/", (req, res) => {
  void campaignsController.list(req, res);
});
