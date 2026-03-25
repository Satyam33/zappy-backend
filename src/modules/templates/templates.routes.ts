import { Router } from "express";
import { templatesController } from "./templates.controller";

export const templatesRoutes = Router();

templatesRoutes.get("/", (req, res) => {
  void templatesController.list(req, res);
});
