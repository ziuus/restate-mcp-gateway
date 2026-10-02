import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { TargetServerConfig } from "../config/config.js";

export interface DiscoveredTool {
  serverId: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export class TargetMCPProcessManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport> = new Map();
  private toolRegistry: Map<string, DiscoveredTool> = new Map();

  public async registerTargetServer(serverConfig: TargetServerConfig): Promise<void> {
    console.log(`[ProcessManager] Registering target MCP server: '${serverConfig.id}' (${serverConfig.command} ${serverConfig.args.join(" ")})`);

    const cleanEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) cleanEnv[k] = v;
    }
    if (serverConfig.env) {
      for (const [k, v] of Object.entries(serverConfig.env)) {
        if (v !== undefined) cleanEnv[k] = v;
      }
    }

    const transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args,
      env: cleanEnv,
    });

    const client = new Client(
      {
        name: `restate-gateway-${serverConfig.id}`,
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);

    this.clients.set(serverConfig.id, client);
    this.transports.set(serverConfig.id, transport);

    // Discover tools from target server
    try {
      const toolList = await client.listTools();
      for (const tool of toolList.tools) {
        this.toolRegistry.set(tool.name, {
          serverId: serverConfig.id,
          name: tool.name,
          description: tool.description,
          inputSchema: (tool.inputSchema as Record<string, unknown>) || {},
        });
        console.log(`  [Discovered Tool] ${tool.name} (Server: ${serverConfig.id})`);
      }
    } catch (err) {
      console.warn(`[ProcessManager] Failed to list tools from server '${serverConfig.id}':`, err);
    }
  }

  public getDiscoveredTools(): DiscoveredTool[] {
    return Array.from(this.toolRegistry.values());
  }

  public findTool(toolName: string): DiscoveredTool | undefined {
    return this.toolRegistry.get(toolName);
  }

  public async executeToolOnTarget(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const discovered = this.toolRegistry.get(toolName);
    if (!discovered) {
      throw new Error(`Tool '${toolName}' is not registered on any target MCP server`);
    }

    const client = this.clients.get(discovered.serverId);
    if (!client) {
      throw new Error(`Client for target server '${discovered.serverId}' is not available`);
    }

    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    return result;
  }

  public async shutdownAll(): Promise<void> {
    for (const [id, client] of this.clients.entries()) {
      try {
        await client.close();
        console.log(`[ProcessManager] Closed target server '${id}'`);
      } catch (err) {
        console.error(`[ProcessManager] Error closing target server '${id}':`, err);
      }
    }
    this.clients.clear();
    this.transports.clear();
    this.toolRegistry.clear();
  }
}
