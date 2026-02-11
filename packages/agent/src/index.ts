import { loadAgentConfig } from "./agent-config.js";
import { MonitoringAgent } from "./monitoring-agent.js";

async function main() {
  const config = loadAgentConfig();

  console.info(`Agent starting: node=${config.AGENT_NODE_ID} role=${config.AGENT_NODE_ROLE}`);
  console.info(`Server: ${config.AGENT_SERVER_URL}`);
  console.info(`Heartbeat interval: ${config.AGENT_HEARTBEAT_INTERVAL}ms`);

  const agent = new MonitoringAgent(config);

  // Graceful shutdown
  const shutdown = async () => {
    console.info("Agent shutting down...");
    await agent.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start the agent
  try {
    await agent.start();
  } catch (error) {
    console.error("Failed to start agent:", error);
    process.exit(1);
  }
}

main();
