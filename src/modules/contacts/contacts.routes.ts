import { Router } from "express";
import { contactsController } from "./contacts.controller";

export const contactsRoutes = Router();

contactsRoutes.get("/", (req, res) => {
  void contactsController.list(req, res);
});
