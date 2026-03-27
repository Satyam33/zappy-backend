import { Router } from "express";
import { contactsController } from "./contacts.controller";

export const contactsRoutes = Router();

contactsRoutes.get("/", (req, res) => {
  void contactsController.list(req, res);
});

contactsRoutes.post("/", (req, res) => {
  void contactsController.create(req, res);
});

contactsRoutes.put("/:id", (req, res) => {
  void contactsController.update(req, res);
});

contactsRoutes.delete("/:id", (req, res) => {
  void contactsController.delete(req, res);
});

contactsRoutes.post("/bulk-delete", (req, res) => {
  void contactsController.bulkDelete(req, res);
});
