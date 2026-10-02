import * as restate from "@restatedev/restate-sdk";
const RISKY_TOOLS = new Set(["delete_file", "execute_command", "drop_table", "send_email"]);
// Virtual Object: Stores per-session tool execution history and state
export const durableMCPTool = restate.object({
    name: "DurableMCPTool",
    handlers: {
        // Execute tool durably with retries & optional human approval gate
        async execute(ctx, req) {
            const audit = (await ctx.get("audit_log")) || {
                sessionId: req.sessionId,
                executions: [],
            };
            const isRisky = req.requiresApproval ?? RISKY_TOOLS.has(req.toolName);
            // Policy Check: Risky tools suspend via Restate Awakeable until approved
            if (isRisky) {
                console.log(`[DurableMCPTool] Tool '${req.toolName}' is RISKY. Suspending for Human-in-the-Loop approval...`);
                // Create a Restate Awakeable (durable promise surviving crashes)
                const { id: awakeableId, promise } = ctx.awakeable();
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
                    const rejectedEntry = {
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
                const successEntry = {
                    toolName: req.toolName,
                    status: "COMPLETED",
                    result,
                    timestamp: new Date().toISOString(),
                };
                audit.executions.push(successEntry);
                ctx.set("audit_log", audit);
                return successEntry;
            }
            catch (err) {
                const errorEntry = {
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
        async resolveApproval(ctx, payload) {
            ctx.resolveAwakeable(payload.awakeableId, payload.approve);
            return { success: true, awakeableId: payload.awakeableId, approved: payload.approve };
        },
        // Get full execution audit log
        async getAuditLog(ctx) {
            return (await ctx.get("audit_log")) || {
                sessionId: ctx.key,
                executions: [],
            };
        },
    },
});
// Simulated tool execution dispatcher
async function executeToolInternal(toolName, args) {
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
