import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { authMiddleware } from "./middleware/auth";
import { tenantMiddleware } from "./middleware/tenant";
import { planGuardMiddleware } from "./middleware/planGuard";
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler } from "./middleware/errorHandler";
import { contactsRoutes } from "./modules/contacts/contacts.routes";
import { campaignsRoutes } from "./modules/campaigns/campaigns.routes";
import { templatesRoutes } from "./modules/templates/templates.routes";
import { inboxRoutes } from "./modules/inbox/inbox.routes";
import { analyticsRoutes } from "./modules/analytics/analytics.routes";
import { billingRoutes } from "./modules/billing/billing.routes";
import { settingsRoutes } from "./modules/settings/settings.routes";
import { webhookRoutes } from "./modules/webhook/webhook.routes";
import { authRoutes } from "./modules/auth/auth.routes";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.APP_URL,
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use(requestLogger);

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "zappy-backend",
    websocket: "socket.io"
  });
});

app.use("/webhook/whatsapp", webhookRoutes);
app.use("/api/v1/auth", authRoutes);  

app.use("/api/v1", authMiddleware, tenantMiddleware, planGuardMiddleware);
app.use("/api/v1/contacts", contactsRoutes);
app.use("/api/v1/campaigns", campaignsRoutes);
app.use("/api/v1/templates", templatesRoutes);
app.use("/api/v1/conversations", inboxRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1/settings", settingsRoutes);

app.use(errorHandler);
