import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

export const TargetServerConfigSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  autoRestart: z.boolean().default(true),
});

export const PolicyRuleSchema = z.object({
  toolPattern: z.string(),
  requiresApproval: z.boolean().default(true),
  maxRetries: z.number().default(3),
  timeoutMs: z.number().default(30000),
  rateLimitScope: z.string().optional(),
});

export const GatewayConfigSchema = z.object({
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default("0.0.0.0"),
    apiKey: z.string().optional(),
    adminApiKey: z.string().optional(),
  }).default({ port: 3000, host: "0.0.0.0" }),
  restate: z.object({
    servicePort: z.number().default(9088),
    ingressUrl: z.string().default("http://localhost:8080"),
  }).default({ servicePort: 9088, ingressUrl: "http://localhost:8080" }),
  policy: z.object({
    approvalTimeoutMs: z.number().default(86400000),
    rules: z.array(PolicyRuleSchema).default([
      { toolPattern: "delete_.*", requiresApproval: true, maxRetries: 3, timeoutMs: 30000 },
      { toolPattern: "execute_.*", requiresApproval: true, maxRetries: 3, timeoutMs: 30000 },
      { toolPattern: "drop_.*", requiresApproval: true, maxRetries: 3, timeoutMs: 30000 },
      { toolPattern: "send_.*", requiresApproval: true, maxRetries: 3, timeoutMs: 30000 },
    ]),
  }).default({ approvalTimeoutMs: 86400000, rules: [] }),
  targetServers: z.array(TargetServerConfigSchema).default([]),
});

export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;
export type TargetServerConfig = z.infer<typeof TargetServerConfigSchema>;
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

let cachedConfig: GatewayConfig | null = null;

export function loadGatewayConfig(configPath?: string): GatewayConfig {
  if (cachedConfig && !configPath) return cachedConfig;

  const targetPath = configPath || process.env.GATEWAY_CONFIG_PATH || path.resolve(process.cwd(), "gateway.config.json");

  let fileContent: Record<string, unknown> = {};
  if (fs.existsSync(targetPath)) {
    try {
      const raw = fs.readFileSync(targetPath, "utf-8");
      fileContent = JSON.parse(raw);
    } catch (err) {
      console.warn(`[Config] Failed to parse ${targetPath}, falling back to defaults:`, err);
    }
  }

  // Override with environment variables if present
  if (process.env.PORT) {
    fileContent.server = { ...(fileContent.server as object), port: parseInt(process.env.PORT, 10) };
  }
  if (process.env.GATEWAY_API_KEY) {
    fileContent.server = { ...(fileContent.server as object), apiKey: process.env.GATEWAY_API_KEY };
  }
  if (process.env.ADMIN_API_KEY) {
    fileContent.server = { ...(fileContent.server as object), adminApiKey: process.env.ADMIN_API_KEY };
  }
  if (process.env.RESTATE_INGRESS_URL) {
    fileContent.restate = { ...(fileContent.restate as object), ingressUrl: process.env.RESTATE_INGRESS_URL };
  }

  cachedConfig = GatewayConfigSchema.parse(fileContent);
  return cachedConfig;
}

export function resetConfigCache() {
  cachedConfig = null;
}
