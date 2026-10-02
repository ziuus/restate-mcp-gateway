import { describe, it, expect } from "vitest";
import { PolicyEngine } from "../src/config/policy.js";
import { GatewayConfigSchema } from "../src/config/config.js";

describe("PolicyEngine Rules Evaluation", () => {
  const config = GatewayConfigSchema.parse({
    policy: {
      rules: [
        { toolPattern: "delete_.*", requiresApproval: true, maxRetries: 1, timeoutMs: 10000 },
        { toolPattern: "execute_.*", requiresApproval: true, maxRetries: 0, timeoutMs: 5000 },
        { toolPattern: "read_.*", requiresApproval: false, maxRetries: 5, timeoutMs: 60000 },
      ],
    },
  });

  const engine = new PolicyEngine(config);

  it("should mark risky tools for approval", () => {
    const res1 = engine.evaluate("delete_file", { path: "/etc/passwd" });
    expect(res1.requiresApproval).toBe(true);

    const res2 = engine.evaluate("execute_command", { command: "rm -rf /" });
    expect(res2.requiresApproval).toBe(true);
  });

  it("should auto-approve safe tools", () => {
    const res = engine.evaluate("read_file", { path: "/tmp/test.txt" });
    expect(res.requiresApproval).toBe(false);
  });

  it("should apply default policy for unlisted tools", () => {
    const res = engine.evaluate("unlisted_tool");
    expect(res.requiresApproval).toBe(false);
    expect(res.maxRetries).toBe(3);
  });
});
