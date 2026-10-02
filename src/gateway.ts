import express, { Request, Response } from "express";
import { connect, IngressClient } from "@restatedev/restate-sdk-clients";
import { durableMCPTool } from "./restate-services/durable-tool.js";

const app = express();
app.use(express.json());

const RESTATE_INGRESS_URL = process.env.RESTATE_INGRESS_URL || "http://localhost:8080";
const PORT = parseInt(process.env.PORT || "3000", 10);

let restateClient: ReturnType<typeof connect>;

export function createGatewayApp() {
  restateClient = connect({ url: RESTATE_INGRESS_URL });

  // 1. Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", restateIngress: RESTATE_INGRESS_URL });
  });

  // 2. MCP Tool Execution Endpoint (Durable Proxy)
  app.post("/mcp/v1/call", async (req: Request, res: Response) => {
    try {
      const { sessionId = "default-session", toolName, args, requiresApproval } = req.body;

      if (!toolName) {
        return res.status(400).json({ error: "Missing 'toolName' parameter" });
      }

      console.log(`[Gateway] Received MCP tool call: '${toolName}' (Session: ${sessionId})`);

      // Connect to Restate Durable Virtual Object for this session
      const toolClient = restateClient.objectClient(durableMCPTool, sessionId);

      // Route through Restate for durable execution / policy check
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

  // 3. Human-in-the-Loop Resolution Endpoint (Approve / Reject)
  app.post("/mcp/v1/approve", async (req: Request, res: Response) => {
    try {
      const { awakeableId, approve } = req.body;

      if (!awakeableId) {
        return res.status(400).json({ error: "Missing 'awakeableId' parameter" });
      }

      console.log(`[Gateway] Resolving awakeable directly: ID=${awakeableId}, Approved=${approve}`);

      // Resolve awakeable directly via Restate Ingress Client (bypass Virtual Object lock)
      await restateClient.resolveAwakeable(awakeableId, approve);

      return res.json({ success: true, awakeableId, approved: approve });

    } catch (err) {
      console.error("[Gateway] Error resolving approval:", err);
      return res.status(500).json({ error: "Failed to resolve approval", details: String(err) });
    }
  });

  // 4. Audit Log Endpoint
  app.get("/mcp/v1/audit/:sessionId", async (req: Request, res: Response) => {
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
  const serverApp = createGatewayApp();
  serverApp.listen(PORT, () => {
    console.log(`🚀 Restate MCP Gateway listening on http://localhost:${PORT}`);
    console.log(`   - MCP Tool Endpoint:  POST http://localhost:${PORT}/mcp/v1/call`);
    console.log(`   - HITL Approval API:   POST http://localhost:${PORT}/mcp/v1/approve`);
    console.log(`   - Audit Log API:       GET  http://localhost:${PORT}/mcp/v1/audit/:sessionId`);
  });
}
