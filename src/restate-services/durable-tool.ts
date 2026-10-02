import * as restate from "@restatedev/restate-sdk";

export interface ToolExecutionRequest {
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  requiresApproval?: boolean;
}

export interface ToolExecutionResult {
  toolName: string;
  status: "COMPLETED" | "REJECTED" | "FAILED" | "PENDING_APPROVAL";
  result?: unknown;
  error?: string;
  timestamp: string;
  approvalId?: string;
}

export interface ToolAuditLog {
  sessionId: string;
  executions: ToolExecutionResult[];
}

const RISKY_TOOLS = new Set(["delete_file", "execute_command", "drop_table", "send_email"]);

// Virtual Object: Stores per-session tool execution history and state
export const durableMCPTool = restate.object({
  name: "DurableMCPTool",
  handlers: {
    // Execute tool durably with retries & optional human approval gate
    async execute(ctx: restate.ObjectContext, req: ToolExecutionRequest): Promise<ToolExecutionResult> {
      const audit = (await ctx.get<ToolAuditLog>("audit_log")) || {
        sessionId: req.sessionId,
        executions: [],
      };

      const isRisky = req.requiresApproval ?? RISKY_TOOLS.has(req.toolName);

      // Policy Check: Risky tools suspend via Restate Awakeable until approved
      if (isRisky) {
        console.log(`[DurableMCPTool] Tool '${req.toolName}' is RISKY. Suspending for Human-in-the-Loop approval...`);
        
        // Create a Restate Awakeable (durable promise surviving crashes)
        const { id: awakeableId, promise } = ctx.awakeable<boolean>();

        // Store pending approval state in Restate KV
        ctx.set(`pending_approval:${awakeableId}`, {
          toolName: req.toolName,
          args: req.args,
          sessionId: req.sessionId,
          timestamp: new Date().toISOString(),
        });

        console.log(`[DurableMCPTool] Awaiting approval. Awakeable ID: ${awakeableId}`);

        // Durable wait: zero CPU/RAM used while suspended
        const approved = await promise;

        ctx.clear(`pending_approval:${awakeableId}`);

        if (!approved) {
          const rejectedEntry: ToolExecutionResult = {
            toolName: req.toolName,
            status: "REJECTED",
            error: "Execution rejected by policy administrator",
            timestamp: new Date().toISOString(),
            approvalId: awakeableId,
          };
          audit.executions.push(rejectedEntry);
          ctx.set("audit_log", audit);
          return rejectedEntry;
        }
      }

      // Execute tool durably via ctx.run (auto-retries on transient failure)
      try {
        const result = await ctx.run(`run-${req.toolName}`, async () => {
          return await executeToolInternal(req.toolName, req.args);
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
        const errorEntry: ToolExecutionResult = {
          toolName: req.toolName,
          status: "FAILED",
          error: String(err),
          timestamp: new Date().toISOString(),
        };

        audit.executions.push(errorEntry);
        ctx.set("audit_log", audit);
        return errorEntry;
      }
    },

    // Resolve an awakeable approval (Approve or Reject)
    async resolveApproval(ctx: restate.ObjectContext, payload: { awakeableId: string; approve: boolean }) {
      ctx.resolveAwakeable(payload.awakeableId, payload.approve);
      return { success: true, awakeableId: payload.awakeableId, approved: payload.approve };
    },

    // Get full execution audit log
    async getAuditLog(ctx: restate.ObjectSharedContext): Promise<ToolAuditLog> {
      return (await ctx.get<ToolAuditLog>("audit_log")) || {
        sessionId: ctx.key,
        executions: [],
      };
    },
  },
});

// Simulated tool execution dispatcher
async function executeToolInternal(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  // Simulate execution latency
  await new Promise((resolve) => setTimeout(resolve, 80));

  switch (toolName) {
    case "read_file":
      return { content: `[Restate Gateway] Read file contents of ${args.path}` };
    case "write_file":
      return { content: `[Restate Gateway] Successfully wrote to ${args.path}` };
    case "delete_file":
      return { content: `[Restate Gateway] File ${args.path} deleted permanently` };
    case "execute_command":
      return { content: `[Restate Gateway] Command '${args.command}' executed with exit code 0` };
    default:
      return { content: `[Restate Gateway] Tool '${toolName}' executed with args ${JSON.stringify(args)}` };
  }
}

export const services = [durableMCPTool];
