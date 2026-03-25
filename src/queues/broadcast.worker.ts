import { Worker, type Job } from "bullmq";
import { bullmqConnection } from "../config/redis";
import { wsManager } from "../websocket/ws.manager";

type BroadcastJob = {
  orgId: string;
  campaignId: string;
};

export const broadcastWorker = new Worker<BroadcastJob>(
  "broadcasts",
  async (job: Job<BroadcastJob>) => {
    wsManager.sendToOrg(job.data.orgId, {
      type: "CAMPAIGN_PROGRESS",
      campaignId: job.data.campaignId,
      progress: 100
    });
  },
  { connection: bullmqConnection }
);
