import { describe, it, expect, beforeEach, vi } from "vitest";
import { TargetMCPProcessManager } from "../src/mcp/process-manager.js";

// Mock the MCP SDK client
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({
      tools: [
        { name: "read_file", description: "Read contents of a file", inputSchema: { type: "object", properties: { path: { type: "string" } } } },
        { name: "write_file", description: "Write content to a file", inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } } } },
        { name: "delete_file", description: "Delete a file from disk", inputSchema: { type: "object", properties: { path: { type: "string" } } } },
        { name: "execute_command", description: "Execute a shell command", inputSchema: { type: "object", properties: { command: { type: "string" } } } },
      ],
    }),
    close: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn().mockResolvedValue({ content: "ok" }),
  })),
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: vi.fn(),
}));

describe("TargetMCPProcessManager Tool Annotations", () => {
  let processManager: TargetMCPProcessManager;

  beforeEach(() => {
    processManager = new TargetMCPProcessManager();
  });

  it("should register target server and discover all 4 tools with annotations", async () => {
    await processManager.registerTargetServer({
      id: "test-server",
      command: "node",
      args: ["test-server.js"],
      autoRestart: true,
    });

    const tools = processManager.getDiscoveredTools();
    expect(tools).toHaveLength(4);

    // Check each tool has annotations
    for (const tool of tools) {
      expect(tool.readOnlyHint).toBeDefined();
      expect(tool.destructiveHint).toBeDefined();
      expect(tool.idempotentHint).toBeDefined();
      expect(tool.openWorldHint).toBeDefined();
    }
  });

  it("should have correct annotations for read_file", async () => {
    await processManager.registerTargetServer({
      id: "test-server",
      command: "node",
      args: ["test-server.js"],
      autoRestart: true,
    });

    const readFileTool = processManager.findTool("read_file");
    expect(readFileTool).toBeDefined();
    expect(readFileTool?.readOnlyHint).toBe(true);
    expect(readFileTool?.destructiveHint).toBe(false);
    expect(readFileTool?.idempotentHint).toBe(true);
    expect(readFileTool?.openWorldHint).toBe(false);
  });

  it("should have correct annotations for write_file", async () => {
    await processManager.registerTargetServer({
      id: "test-server",
      command: "node",
      args: ["test-server.js"],
      autoRestart: true,
    });

    const writeFileTool = processManager.findTool("write_file");
    expect(writeFileTool).toBeDefined();
    expect(writeFileTool?.readOnlyHint).toBe(false);
    expect(writeFileTool?.destructiveHint).toBe(true);
    expect(writeFileTool?.idempotentHint).toBe(false);
    expect(writeFileTool?.openWorldHint).toBe(false);
  });

  it("should have correct annotations for delete_file", async () => {
    await processManager.registerTargetServer({
      id: "test-server",
      command: "node",
      args: ["test-server.js"],
      autoRestart: true,
    });

    const deleteFileTool = processManager.findTool("delete_file");
    expect(deleteFileTool).toBeDefined();
    expect(deleteFileTool?.readOnlyHint).toBe(false);
    expect(deleteFileTool?.destructiveHint).toBe(true);
    expect(deleteFileTool?.idempotentHint).toBe(true);
    expect(deleteFileTool?.openWorldHint).toBe(false);
  });

  it("should have correct annotations for execute_command", async () => {
    await processManager.registerTargetServer({
      id: "test-server",
      command: "node",
      args: ["test-server.js"],
      autoRestart: true,
    });

    const executeCommandTool = processManager.findTool("execute_command");
    expect(executeCommandTool).toBeDefined();
    expect(executeCommandTool?.readOnlyHint).toBe(false);
    expect(executeCommandTool?.destructiveHint).toBe(true);
    expect(executeCommandTool?.idempotentHint).toBe(false);
    expect(executeCommandTool?.openWorldHint).toBe(true);
  });
});