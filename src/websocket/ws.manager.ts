import type { Server as SocketIOServer } from "socket.io";

type EmitPayload = {
  type: string;
  [key: string]: unknown;
};

class WebSocketManager {
  private io: SocketIOServer | null = null;

  attach(io: SocketIOServer): void {
    this.io = io;
  }

  sendToOrg(orgId: string, payload: EmitPayload): void {
    if (!this.io) {
      return;
    }
    this.io.to(`org:${orgId}`).emit("org:event", payload);
  }
}

export const wsManager = new WebSocketManager();
