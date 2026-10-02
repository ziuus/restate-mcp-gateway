import express, { Request, Response } from "express";
import { connect } from "@restatedev/restate-sdk-clients";
import { durableMCPTool } from "./restate-services/durable-mcp.js";
import { loadGatewayConfig } from "./config/config.js";
import { authenticateGatewayRequest, authenticateAdminRequest } from "./middleware/auth.js";
import { TargetMCPProcessManager } from "./mcp/process-manager.js";

const app = express();
app.use(express.json());

let restateClient: ReturnType<typeof connect>;
let processManagerRef: TargetMCPProcessManager | null = null;

export function setProcessManagerForGateway(manager: TargetMCPProcessManager) {
  processManagerRef = manager;
}

export function createGatewayApp() {
  const config = loadGatewayConfig();
  restateClient = connect({ url: config.restate.ingressUrl });

  // 1. Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      restateIngress: config.restate.ingressUrl,
      targetServersCount: config.targetServers.length,
      discoveredToolsCount: processManagerRef ? processManagerRef.getDiscoveredTools().length : 0,
    });
  });

  // 2. Discovered Tools Endpoint
  app.get("/mcp/v1/tools", authenticateGatewayRequest, (_req: Request, res: Response) => {
    const tools = processManagerRef ? processManagerRef.getDiscoveredTools() : [];
    return res.json({ tools, count: tools.length });
  });

  // 3. MCP Tool Call Proxy Endpoint
  app.post("/mcp/v1/call", authenticateGatewayRequest, async (req: Request, res: Response) => {
    try {
      const { sessionId = "default-session", toolName, args, requiresApproval } = req.body;

      if (!toolName) {
        return res.status(400).json({ error: "Missing 'toolName' parameter" });
      }

      console.log(`[Gateway] Dispatching tool '${toolName}' (Session: ${sessionId})`);

      const toolClient = restateClient.objectClient(durableMCPTool, sessionId);
      const result = await toolClient.execute({
        sessionId,
        toolName,
        args: args || {},
        requiresApproval,
      });

      return res.json(result);

    } catch (err) {
      console.error("[Gateway] Error handling MCP tool call:", err);
      return res.status(500).json({ error: "Internal Gateway Error", details: String(err) });
    }
  });

  // 4. Admin Human-in-the-Loop Resolution Endpoint
  app.post("/mcp/v1/approve", authenticateAdminRequest, async (req: Request, res: Response) => {
    try {
      const { awakeableId, approve } = req.body;

      if (!awakeableId) {
        return res.status(400).json({ error: "Missing 'awakeableId' parameter" });
      }

      console.log(`[Gateway] Resolving awakeable: ID=${awakeableId}, Approved=${approve}`);

      // Bypass Virtual Object key lock by resolving Awakeable directly on Restate Ingress Client
      await restateClient.resolveAwakeable(awakeableId, approve);

      return res.json({ success: true, awakeableId, approved: approve });

    } catch (err) {
      console.error("[Gateway] Error resolving approval:", err);
      return res.status(500).json({ error: "Failed to resolve approval", details: String(err) });
    }
  });

  // 5. Session Audit Log Endpoint
  app.get("/mcp/v1/audit/:sessionId", authenticateGatewayRequest, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const toolClient = restateClient.objectClient(durableMCPTool, sessionId);
      const auditLog = await toolClient.getAuditLog();

      return res.json(auditLog);

    } catch (err) {
      console.error("[Gateway] Error fetching audit log:", err);
      return res.status(500).json({ error: "Failed to fetch audit log", details: String(err) });
    }
  });

  return app;
}

export function startGateway() {
  const config = loadGatewayConfig();
  const serverApp = createGatewayApp();

  serverApp.listen(config.server.port, config.server.host, () => {
    console.log(`🚀 Restate MCP Gateway running on http://${config.server.host}:${config.server.port}`);
    console.log(`   - MCP Tools List:   GET  http://localhost:${config.server.port}/mcp/v1/tools`);
    console.log(`   - MCP Tool Call:    POST http://localhost:${config.server.port}/mcp/v1/call`);
    console.log(`   - Admin Approve:    POST http://localhost:${config.server.port}/mcp/v1/approve`);
    console.log(`   - Audit Logs:       GET  http://localhost:${config.server.port}/mcp/v1/audit/:sessionId`);
  });
}
