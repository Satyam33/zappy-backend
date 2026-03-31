import { Router } from "express";
import { inboxController } from "./inbox.controller";

export const inboxRoutes = Router();

inboxRoutes.get("/", (req, res) => {
  void inboxController.listConversations(req, res);
});

inboxRoutes.get("/:id/messages", (req, res) => {
  void inboxController.listMessages(req, res);
});

inboxRoutes.post("/:id/messages", (req, res) => {
  void inboxController.sendMessage(req, res);
});

inboxRoutes.patch("/:id", (req, res) => {
  void inboxController.patchConversation(req, res);
});
