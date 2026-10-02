import { endpoint } from "@restatedev/restate-sdk";
import { services } from "./restate-services/durable-tool.js";
import { startGateway } from "./gateway.js";
const RESTATEDEV_PORT = parseInt(process.env.RESTATE_SERVICE_PORT || "9088", 10);
async function main() {
    // 1. Bind Restate services
    const ep = endpoint();
    for (const svc of services) {
        ep.bind(svc);
    }
    await ep.listen(RESTATEDEV_PORT);
    console.log(`[Restate Services] Bound DurableMCPTool on port ${RESTATEDEV_PORT}`);
    // 2. Start Gateway Express Server
    startGateway();
}
main().catch((err) => {
    console.error("Fatal error starting Restate MCP Gateway:", err);
    process.exit(1);
});
