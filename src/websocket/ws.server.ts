import { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "../config/env";
import { wsManager } from "./ws.manager";

const socketAllowedOrigins = new Set([
  env.APP_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  "https://zappy-frontend-agent.vercel.app",
  ...(env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? [])
]);

export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || socketAllowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Socket.IO CORS blocked: ${origin}`));
      },
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    const orgId =
      typeof socket.handshake.auth?.orgId === "string"
        ? socket.handshake.auth.orgId
        : typeof socket.handshake.query.orgId === "string"
          ? socket.handshake.query.orgId
          : null;

    if (!orgId) {
      socket.emit("error", { code: "WS_ORG_REQUIRED" });
      socket.disconnect(true);
      return;
    }

    socket.join(`org:${orgId}`);
    socket.emit("connected", { ok: true, orgId });
  });

  wsManager.attach(io);
  return io;
};
