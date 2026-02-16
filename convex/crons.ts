import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";

const crons = cronJobs();

// Clean up stale presence records every 60 seconds
crons.interval(
  "presence cleanup",
  { seconds: 60 },
  api.presence.cleanup
);

export default crons;
