import { GatewayConfig, PolicyRule } from "./config.js";

export interface PolicyEvaluationResult {
  requiresApproval: boolean;
  matchingRule?: PolicyRule;
  maxRetries: number;
  timeoutMs: number;
  rateLimitScope?: string;
}

export class PolicyEngine {
  private config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  public evaluate(toolName: string, _args: Record<string, unknown> = {}): PolicyEvaluationResult {
    const rules = this.config.policy.rules;

    for (const rule of rules) {
      try {
        const regex = new RegExp(`^${rule.toolPattern}$`, "i");
        if (regex.test(toolName)) {
          return {
            requiresApproval: rule.requiresApproval,
            matchingRule: rule,
            maxRetries: rule.maxRetries,
            timeoutMs: rule.timeoutMs,
            rateLimitScope: rule.rateLimitScope,
          };
        }
      } catch {
        // Fallback for string includes if regex compilation fails
        if (toolName.includes(rule.toolPattern)) {
          return {
            requiresApproval: rule.requiresApproval,
            matchingRule: rule,
            maxRetries: rule.maxRetries,
            timeoutMs: rule.timeoutMs,
            rateLimitScope: rule.rateLimitScope,
          };
        }
      }
    }

    // Default policy: non-matching tools auto-execute without HITL
    return {
      requiresApproval: false,
      maxRetries: 3,
      timeoutMs: 30000,
    };
  }
}
