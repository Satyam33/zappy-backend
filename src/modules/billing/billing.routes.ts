import { Router } from "express";
import { billingController } from "./billing.controller";

export const billingRoutes = Router();

billingRoutes.get("/usage", (req, res) => {
  void billingController.usage(req, res);
});
