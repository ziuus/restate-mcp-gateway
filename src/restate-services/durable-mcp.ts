import * as restate from "@restatedev/restate-sdk";
import { PolicyEngine } from "../config/policy.js";
import { loadGatewayConfig } from "../config/config.js";
import { TargetMCPProcessManager } from "../mcp/process-manager.js";

export interface ToolExecutionRequest {
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  requiresApproval?: boolean;
}

export interface ToolExecutionResult {
  toolName: string;
  status: "COMPLETED" | "REJECTED" | "FAILED" | "PENDING_APPROVAL" | "TIMED_OUT";
  result?: unknown;
  error?: string;
  timestamp: string;
  approvalId?: string;
}

export interface ToolAuditLog {
  sessionId: string;
  executions: ToolExecutionResult[];
}

let processManagerRef: TargetMCPProcessManager | null = null;

export function setProcessManager(manager: TargetMCPProcessManager) {
  processManagerRef = manager;
}

export const durableMCPTool = restate.object({
  name: "DurableMCPTool",
  handlers: {
    // Main Durable Tool Handler
    async execute(ctx: restate.ObjectContext, req: ToolExecutionRequest): Promise<ToolExecutionResult> {
      const config = loadGatewayConfig();
      const policyEngine = new PolicyEngine(config);
      const policy = policyEngine.evaluate(req.toolName, req.args);

      const audit = (await ctx.get<ToolAuditLog>("audit_log")) || {
        sessionId: req.sessionId,
        executions: [],
      };

      const isRisky = req.requiresApproval ?? policy.requiresApproval;

      // Policy Gate: Suspend execution via Restate Awakeable if risky
      if (isRisky) {
        console.log(`[DurableMCPTool] '${req.toolName}' triggered HITL policy. Suspending for approval...`);

        const { id: awakeableId, promise } = ctx.awakeable<boolean>();

        // Store awakeable metadata in Restate KV state
        ctx.set(`pending_approval:${awakeableId}`, {
          toolName: req.toolName,
          args: req.args,
          sessionId: req.sessionId,
          timestamp: new Date().toISOString(),
          policyRule: policy.matchingRule?.toolPattern,
        });

        console.log(`[DurableMCPTool] Awaiting human sign-off. Awakeable ID: ${awakeableId}`);

        // Durable wait with zero CPU/RAM footprint
        const approved = await promise;

        ctx.clear(`pending_approval:${awakeableId}`);

        if (!approved) {
          const rejectedEntry: ToolExecutionResult = {
            toolName: req.toolName,
            status: "REJECTED",
            error: "Execution rejected by security policy",
            timestamp: new Date().toISOString(),
            approvalId: awakeableId,
          };
          audit.executions.push(rejectedEntry);
          ctx.set("audit_log", audit);
          return rejectedEntry;
        }
      }

      // Execute tool durably via ctx.run
      try {
        const result = await ctx.run(`run-${req.toolName}`, async () => {
          if (processManagerRef && processManagerRef.findTool(req.toolName)) {
            return await processManagerRef.executeToolOnTarget(req.toolName, req.args);
          }
          return await executeToolFallback(req.toolName, req.args);
        });

        const successEntry: ToolExecutionResult = {
          toolName: req.toolName,
          status: "COMPLETED",
          result,
          timestamp: new Date().toISOString(),
        };

        audit.executions.push(successEntry);
        ctx.set("audit_log", audit);
        return successEntry;

      } catch (err) {
        const errorMsg = String(err);
        const errorEntry: ToolExecutionResult = {
          toolName: req.toolName,
          status: "FAILED",
          error: errorMsg,
          timestamp: new Date().toISOString(),
        };

        audit.executions.push(errorEntry);
        ctx.set("audit_log", audit);

        // Terminal error handling for unrecoverable tool failures
        if (errorMsg.includes("is not registered") || errorMsg.includes("Invalid arguments")) {
          throw new restate.TerminalError(errorMsg);
        }

        return errorEntry;
      }
    },

    // Query active audit log
    async getAuditLog(ctx: restate.ObjectSharedContext): Promise<ToolAuditLog> {
      return (await ctx.get<ToolAuditLog>("audit_log")) || {
        sessionId: ctx.key,
        executions: [],
      };
    },
  },
});

// Fallback executor for stand-alone & sample tool execution
async function executeToolFallback(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 60));
  switch (toolName) {
    case "read_file":
      return { content: `[Target Server] Contents of '${args.path}'` };
    case "write_file":
      return { content: `[Target Server] Wrote to '${args.path}'` };
    case "delete_file":
      return { content: `[Target Server] Deleted file '${args.path}'` };
    case "execute_command":
      return { content: `[Target Server] Command '${args.command}' finished successfully.` };
    default:
      return { content: `[Target Server] Executed tool '${toolName}' with ${JSON.stringify(args)}` };
  }
}

export const services = [durableMCPTool];
