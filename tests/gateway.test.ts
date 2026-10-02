import { describe, it, expect } from "vitest";
import { durableMCPTool } from "../src/restate-services/durable-tool.js";

describe("Restate MCP Gateway Services", () => {
  it("should have correct DurableMCPTool object name", () => {
    expect(durableMCPTool.name).toBe("DurableMCPTool");
  });
});
