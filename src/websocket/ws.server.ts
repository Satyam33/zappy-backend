import { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "../config/env";
import { wsManager } from "./ws.manager";

export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.APP_URL,
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
