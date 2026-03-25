import { Router } from "express";
import { inboxController } from "./inbox.controller";

export const inboxRoutes = Router();

inboxRoutes.get("/", (req, res) => {
  void inboxController.listConversations(req, res);
});
