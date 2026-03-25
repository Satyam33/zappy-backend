import { Router } from "express";
import { analyticsController } from "./analytics.controller";

export const analyticsRoutes = Router();

analyticsRoutes.get("/summary", (req, res) => {
  void analyticsController.summary(req, res);
});
