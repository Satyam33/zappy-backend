import { Router } from "express";
import { webhookController } from "./webhook.controller";

export const webhookRoutes = Router();

webhookRoutes.get("/", (req, res) => {
  webhookController.verify(req, res);
});

webhookRoutes.post("/", (req, res) => {
  void webhookController.receive(req, res);
});
