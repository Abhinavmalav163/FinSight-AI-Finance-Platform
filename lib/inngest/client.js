import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({
  name: "FinSight AI",
  id: "finsight-ai",
  apiBaseUrl: "https://api.inngest.com",
  eventKey: process.env.INNGEST_EVENT_KEY
});
