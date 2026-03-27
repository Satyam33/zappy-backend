import { Router } from "express";
import { templatesController } from "./templates.controller";

export const templatesRoutes = Router();

templatesRoutes.get("/", (req, res) => {
  void templatesController.list(req, res);
});

templatesRoutes.post("/", (req, res) => {
  void templatesController.create(req, res);
});

templatesRoutes.put("/:id", (req, res) => {
  void templatesController.update(req, res);
});

templatesRoutes.post("/sync-status", (req, res) => {
  void templatesController.syncStatus(req, res);
});
