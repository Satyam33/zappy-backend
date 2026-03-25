import { broadcastWorker } from "./queues/broadcast.worker";

broadcastWorker.on("ready", () => {
  // eslint-disable-next-line no-console
  console.log("Broadcast worker ready");
});
