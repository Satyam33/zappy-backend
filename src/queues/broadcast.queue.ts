import { Queue } from "bullmq";
import { bullmqConnection } from "../config/redis";

export const broadcastQueue = new Queue("broadcasts", {
  connection: bullmqConnection
});
