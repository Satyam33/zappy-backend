import { createServer } from "node:http";
import { app } from "./app";
import { env } from "./config/env";
import { ensureDatabaseConnection } from "./config/database";
import { initSocketServer } from "./websocket/ws.server";

const bootstrap = async (): Promise<void> => {
  await ensureDatabaseConnection();
  const httpServer = createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API running on http://localhost:${env.PORT}`);
  });
};

void bootstrap();
