import { endpoint } from "@restatedev/restate-sdk";
import { services, setProcessManager } from "./restate-services/durable-mcp.js";
import { startGateway, setProcessManagerForGateway } from "./gateway.js";
import { loadGatewayConfig } from "./config/config.js";
import { TargetMCPProcessManager } from "./mcp/process-manager.js";

async function main() {
  const config = loadGatewayConfig();
  const processManager = new TargetMCPProcessManager();

  // 1. Register target MCP servers if configured
  for (const serverConfig of config.targetServers) {
    try {
      await processManager.registerTargetServer(serverConfig);
    } catch (err) {
      console.warn(`[Index] Failed to register target server '${serverConfig.id}':`, err);
    }
  }

  setProcessManager(processManager);
  setProcessManagerForGateway(processManager);

  // 2. Bind Restate services
  const ep = endpoint();
  for (const svc of services) {
    ep.bind(svc);
  }

  await ep.listen(config.restate.servicePort);
  console.log(`[Restate Services] Bound DurableMCPTool on port ${config.restate.servicePort}`);

  // 3. Start Gateway Express Server
  startGateway();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[System] Received ${signal}. Shutting down target MCP processes...`);
    await processManager.shutdownAll();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Fatal error starting Restate MCP Gateway:", err);
  process.exit(1);
});
