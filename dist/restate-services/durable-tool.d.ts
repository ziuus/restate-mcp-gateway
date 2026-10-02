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
export declare const durableMCPTool: restate.VirtualObjectDefinition<"DurableMCPTool", {
    execute: (ctx: restate.ObjectContext, req: ToolExecutionRequest) => Promise<ToolExecutionResult>;
    resolveApproval: (ctx: restate.ObjectContext, payload: {
        awakeableId: string;
        approve: boolean;
    }) => Promise<{
        success: boolean;
        awakeableId: string;
        approved: boolean;
    }>;
    getAuditLog: (ctx: restate.ObjectSharedContext) => Promise<ToolAuditLog>;
}>;
export declare const services: restate.VirtualObjectDefinition<"DurableMCPTool", {
    execute: (ctx: restate.ObjectContext, req: ToolExecutionRequest) => Promise<ToolExecutionResult>;
    resolveApproval: (ctx: restate.ObjectContext, payload: {
        awakeableId: string;
        approve: boolean;
    }) => Promise<{
        success: boolean;
        awakeableId: string;
        approved: boolean;
    }>;
    getAuditLog: (ctx: restate.ObjectSharedContext) => Promise<ToolAuditLog>;
}>[];
